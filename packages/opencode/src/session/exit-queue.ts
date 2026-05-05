import { Effect, Layer, Context, Schema } from "effect"
import { SessionID } from "./schema"
import { ModelID } from "@/provider/schema"
import * as Log from "@opencode-ai/core/util/log"
import { codegenieAuth, sessionChatIdMap } from "@/plugin/codegenie"
import https from "https"
import http from "http"
import { URL } from "url"
import crypto from "crypto"

const log = Log.create({ service: "exit-queue" })

export interface Interface {
  readonly exit: (sessionID: SessionID, modelID: ModelID) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ExitQueue") {}

export class ExitQueueError extends Schema.TaggedErrorClass<ExitQueueError>()("ExitQueueError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {}

const QUEUE_EXIT_PATH = "/sse/codeGenie/exitSessionQueue"

// Base URLs for CodeGenie API (same as codegenie.ts)
const BASE_URL_CN = "https://cn.devecostudio.huawei.com"

/**
 * Get the base URL for CodeGenie API (CN region uses different URL)
 */
function getBaseUrl(): string {
  // Use CN region by default (matching DEFAULT_CONFIG.countryCode = "CN")
  return BASE_URL_CN
}

/**
 * Simple HTTP POST request (fire-and-forget for exit queue)
 */
function postRequest(url: string, headers: Record<string, string>, body: object): Promise<void> {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url)
    const isHttps = parsedUrl.protocol === "https:"
    const httpModule = isHttps ? https : http

    const bodyString = JSON.stringify(body)
    const options: http.RequestOptions | https.RequestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyString),
        ...headers,
      },
      timeout: 5000, // 5 second timeout
    }

    const req = httpModule.request(url, options, (res) => {
      // We don't need to read the response body for fire-and-forget
      // Just consume it to free resources
      res.on("data", () => {})
      res.on("end", () => resolve())
    })

    req.on("error", (err) => {
      // Log error but still resolve - exit queue is non-critical
      log.warn("exit queue request error", { error: err.message })
      resolve()
    })

    req.on("timeout", () => {
      req.destroy()
      log.warn("exit queue request timeout")
      resolve()
    })

    req.write(bodyString)
    req.end()
  })
}

const live: Layer.Layer<Service> = Layer.sync(Service, () => {
  const exit = Effect.fn("ExitQueue.exit")(function* (sessionID: SessionID, modelID: ModelID) {
    const baseUrl = getBaseUrl()
    const url = `${baseUrl}${QUEUE_EXIT_PATH}`
    
    log.info("exit queue request", { sessionID, modelID, url })

    // Get current auth token (fire-and-forget - don't block on auth)
    const session = yield* Effect.promise(() => codegenieAuth.getSession())
    const accessToken = session?.accessToken ?? ""

    const headers: Record<string, string> = {
      "sessionId": sessionID,
      "Chat-Id": sessionChatIdMap.get(sessionID) || crypto.randomUUID().replace(/-/g, ""),
      "Authorization": `Bearer ${accessToken}`,
    }

    const body = { modelId: modelID }

    // Execute the POST request (fire-and-forget, errors are swallowed)
    yield* Effect.promise(() => postRequest(url, headers, body))
    
    log.info("exit queue request sent", { sessionID, modelID })
  })

  return Service.of({ exit })
})

export const layer = live
export const defaultLayer = layer

export * as ExitQueue from "./exit-queue"