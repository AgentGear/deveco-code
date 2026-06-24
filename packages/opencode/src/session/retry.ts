import type { NamedError } from "@opencode-ai/core/util/error"
import { Log } from "@opencode-ai/core/util/log"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Cause, Clock, Duration, Effect, Schedule } from "effect"
import { MessageV2 } from "./message-v2"
import { iife } from "@/util/iife"
import { isRecord } from "@/util/record"

const log = Log.create({ service: "session.retry" })

export type Err = ReturnType<NamedError["toObject"]>

export const GO_UPSELL_MESSAGE = "Free usage exceeded, subscribe to Go"
export const GO_UPSELL_URL = "https://opencode.ai/go"
export type RetryReason = "free_tier_limit" | "account_rate_limit" | (string & {})

export type Retryable = {
  message: string
  action?: {
    reason: RetryReason
    provider: string
    title: string
    message: string
    label: string
    link?: string
  }
  maxAttempts?: number
  delays?: number[]
}

export const RETRY_INITIAL_DELAY = 2000
export const RETRY_BACKOFF_FACTOR = 2
export const RETRY_MAX_DELAY_NO_HEADERS = 30_000 // 30 seconds
export const RETRY_MAX_DELAY = 2_147_483_647 // max 32-bit signed integer for setTimeout
export const QUEUE_RETRY_DELAY = 5000

function cap(ms: number) {
  return Math.min(ms, RETRY_MAX_DELAY)
}

export function delay(attempt: number, error?: SessionV1.APIError, isQueue?: boolean) {
  if (isQueue) return QUEUE_RETRY_DELAY
  if (error) {
    const headers = error.data.responseHeaders
    if (headers) {
      const retryAfterMs = headers["retry-after-ms"]
      if (retryAfterMs) {
        const parsedMs = Number.parseFloat(retryAfterMs)
        if (!Number.isNaN(parsedMs)) {
          return cap(parsedMs)
        }
      }

      const retryAfter = headers["retry-after"]
      if (retryAfter) {
        const parsedSeconds = Number.parseFloat(retryAfter)
        if (!Number.isNaN(parsedSeconds)) {
          // convert seconds to milliseconds
          return cap(Math.ceil(parsedSeconds * 1000))
        }
        // Try parsing as HTTP date format
        const parsed = Date.parse(retryAfter) - Date.now()
        if (!Number.isNaN(parsed) && parsed > 0) {
          return cap(Math.ceil(parsed))
        }
      }

      return cap(RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1))
    }
  }

  return cap(Math.min(RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1), RETRY_MAX_DELAY_NO_HEADERS))
}

export function retryable(error: Err, provider: string) {
  // context overflow errors should not be retried
  if (SessionV1.ContextOverflowError.isInstance(error)) return undefined
  // Queue error detection
  if (SessionV1.QueueError.isInstance(error)) {
    log.error("queue error matched", { position: error.data.position, message: error.data.message })
    return { message: error.data.message }
  }
  // ModelServiceRateLimit error detection
  if (SessionV1.ModelServiceRateLimitError.isInstance(error)) {
    log.error("ModelServiceRateLimit error matched", { provider, message: error.data.message })
    return {
      message: error.data.message,
      maxAttempts: 3,
      delays: [10_000, 20_000, 30_000],
    }
  }
  if (SessionV1.APIError.isInstance(error)) {
    const status = error.data.statusCode
    // 403 UserRateLimit detection
    if (status === 403) {
      const body = parseJSON(error.data.responseBody)
      const errorType = typeof body?.error?.type === "string" ? body.error.type : ""
      if (errorType === "UserRateLimit") {
        const errorMsg = typeof body?.error?.message === "string" ? body.error.message : error.data.message
        return {
          message: errorMsg,
          maxAttempts: 3,
          delays: [10_000, 20_000, 30_000],
        }
      }
    }
    // 5xx errors are transient server failures and should always be retried,
    // even when the provider SDK doesn't explicitly mark them as retryable.
    if (!error.data.isRetryable && !(status !== undefined && status >= 500)) return undefined
    if (error.data.responseBody?.includes("FreeUsageLimitError")) {
      return {
        message: GO_UPSELL_MESSAGE,
        action: {
          reason: "free_tier_limit",
          provider,
          title: "Free limit reached",
          message: "Subscribe to OpenCode Go for reliable access to the best open-source models, starting at $5/month.",
          label: "subscribe",
          link: GO_UPSELL_URL,
        },
      }
    }
    if (error.data.responseBody?.includes("GoUsageLimitError")) {
      const body = parseJSON(error.data.responseBody)
      const workspace = str(body?.metadata?.workspace)
      const limitName = str(body?.metadata?.limitName)
      const retryAfter = num(error.data.responseHeaders?.["retry-after"])
      const resetIn = iife(() => {
        if (retryAfter === undefined) return ""
        const seconds = Math.max(0, Math.ceil(retryAfter))
        const days = Math.floor(seconds / 86_400)
        const hours = Math.floor((seconds % 86_400) / 3_600)
        const minutes = Math.ceil((seconds % 3_600) / 60)
        const unit = (value: number, name: string) => `${value} ${name}${value === 1 ? "" : "s"}`

        if (days > 0) return hours > 0 ? `${unit(days, "day")} ${unit(hours, "hour")}` : unit(days, "day")
        if (hours > 0) return minutes > 0 ? `${unit(hours, "hour")} ${unit(minutes, "minute")}` : unit(hours, "hour")
        return minutes > 0 ? unit(minutes, "minute") : "less than a minute"
      })

      const message = `${limitName ? `${limitName} usage limit` : "Usage limit"} reached. It will reset in ${resetIn}. To continue using this model now, enable usage from your available balance`

      const link = `https://opencode.ai/workspace/${workspace}/go`
      return {
        message: `${message} - ${link}`,
        action: {
          reason: "account_rate_limit",
          provider,
          title: "Go limit reached",
          message,
          label: "open settings",
          link,
        },
      }
    }
    return { message: error.data.message.includes("Overloaded") ? "Provider is overloaded" : error.data.message }
  }

  // Check for rate limit patterns in plain text error messages
  const msg = isRecord(error.data) ? error.data.message : undefined
  if (typeof msg === "string") {
    const lower = msg.toLowerCase()
    if (
      lower.includes("rate increased too quickly") ||
      lower.includes("rate limit") ||
      lower.includes("too many requests")
    ) {
      return { message: msg }
    }
  }

  const json = parseJSON(msg)
  if (!json || typeof json !== "object") return undefined
  const code = typeof json.code === "string" ? json.code : ""

  if (json.type === "error" && json.error?.type === "too_many_requests") {
    return { message: "Too Many Requests" }
  }
  if (code.includes("exhausted") || code.includes("unavailable")) {
    return { message: "Provider is overloaded" }
  }
  if (json.type === "error" && typeof json.error?.code === "string" && json.error.code.includes("rate_limit")) {
    return { message: "Rate Limited" }
  }
  return undefined
}

function str(value: unknown) {
  if (value === undefined || value === null) return ""
  return String(value)
}

function num(value: unknown) {
  const parsed = Number.parseFloat(str(value))
  if (Number.isNaN(parsed)) return undefined
  return parsed
}

function parseJSON(value: unknown) {
  return iife(() => {
    try {
      if (typeof value !== "string") return undefined
      return JSON.parse(value)
    } catch {
      return undefined
    }
  })
}

// Error categories for per-category attempt tracking — resetting the counter
// on category change gives each maxAttempts error type its own retry budget.
function getRetryCategory(error: Err): string {
  if (SessionV1.QueueError.isInstance(error)) return "queue"
  if (SessionV1.ModelServiceRateLimitError.isInstance(error)) return "model_service_rate_limit"
  if (SessionV1.APIError.isInstance(error)) {
    const status = error.data.statusCode
    if (status === 403) {
      const body = parseJSON(error.data.responseBody)
      if (typeof body?.error?.type === "string" && body.error.type === "UserRateLimit") {
        return "403_user_rate_limit"
      }
    }
    return `api_${status ?? "unknown"}`
  }
  return "unknown"
}

export function policy(opts: {
  provider: string
  parse: (error: unknown) => Err
  set: (input: { attempt: number; message: string; action?: Retryable["action"]; next: number }) => Effect.Effect<void>
}) {
  let lastCategory: string | undefined
  let categoryAttempt = 0

  return Schedule.fromStepWithMetadata(
    Effect.succeed((meta: Schedule.InputMetadata<unknown>) => {
      const error = opts.parse(meta.input)
      const retry = retryable(error, opts.provider)
      if (!retry) return Cause.done(meta.attempt)

      const category = getRetryCategory(error)
      if (category !== lastCategory) {
        categoryAttempt = 1
        lastCategory = category
      } else {
        categoryAttempt++
      }

      if (retry.maxAttempts !== undefined && categoryAttempt > retry.maxAttempts) {
        return Cause.done(meta.attempt)
      }

      return Effect.gen(function* () {
        const isQueue = SessionV1.QueueError.isInstance(error)
        const effectiveAttempt = retry.maxAttempts !== undefined ? categoryAttempt : meta.attempt
        const wait = retry.delays
          ? (retry.delays[effectiveAttempt - 1] ?? retry.delays[retry.delays.length - 1]!)
          : delay(effectiveAttempt, SessionV1.APIError.isInstance(error) ? error : undefined, isQueue)
        const now = yield* Clock.currentTimeMillis
        yield* opts.set({
          attempt: meta.attempt,
          message: retry.message,
          action: retry.action,
          next: now + wait,
        })
        return [meta.attempt, Duration.millis(wait)] as [number, Duration.Duration]
      })
    }),
  )
}

export * as SessionRetry from "./retry"
