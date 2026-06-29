import fs from "fs"
import { LocalCrypto } from "@/security/local-crypto"
import { Effect } from "effect"

async function log(effect: Effect.Effect<void>) {
  const { AppRuntime } = await import("@/effect/app-runtime")
  return AppRuntime.runPromise(effect)
}
import { devecoAuth } from "./auth"
import { authFilePath, saveAuthToDisk } from "./storage"
import { ACCESS_TOKEN_EXPIRES_MS } from "./types"

/** Module-level dedup: concurrent callers share a single in-flight refresh. */
let refreshPromise: Promise<string | null> | null = null
/** Timestamp of last refresh failure; cooldown prevents rapid retries when refresh token is invalid. */
let lastRefreshFailedAt = 0
const REFRESH_COOLDOWN_MS = 30_000

async function doRefreshToken(): Promise<string | null> {
  await log(Effect.logInfo("ensureValidToken: token expired, refreshing", { service: "deveco" }))
  const newTokens = await devecoAuth.refreshToken()
  if (!newTokens?.accessToken) {
    lastRefreshFailedAt = Date.now()
    await log(Effect.logWarning("ensureValidToken: token refresh failed", { service: "deveco" }))
    return null
  }
  lastRefreshFailedAt = 0

  await saveAuthToDisk("deveco", {
    type: "oauth",
    access: newTokens.accessToken,
    refresh: newTokens.refreshToken,
    expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
  })

  await log(Effect.logInfo("ensureValidToken: token refreshed successfully", { service: "deveco" }))
  return newTokens.accessToken
}

/**
 * Ensure the deveco access token is valid. If expired, refresh it and persist to disk.
 * Returns a valid access token string, or null if no auth is available or refresh fails.
 *
 * Concurrent callers share a single in-flight refresh (no duplicate API calls).
 * After a refresh failure, subsequent calls are short-circuited for REFRESH_COOLDOWN_MS.
 */
export async function ensureValidToken(): Promise<string | null> {
  try {
    if (!fs.existsSync(authFilePath())) return null
    const raw = JSON.parse(fs.readFileSync(authFilePath(), "utf-8")) as Record<string, unknown>
    const data = LocalCrypto.decryptAuthData(raw) as Record<string, unknown>
    const deveco = data.deveco as Record<string, unknown> | undefined
    if (!deveco || deveco.type !== "oauth" || typeof deveco.access !== "string") return null

    const expires = typeof deveco.expires === "number" ? deveco.expires : 0
    if (expires && Date.now() < expires) {
      return deveco.access
    }

    if (lastRefreshFailedAt && Date.now() - lastRefreshFailedAt < REFRESH_COOLDOWN_MS) {
      await log(Effect.logWarning("ensureValidToken: refresh skipped, in cooldown after recent failure", { service: "deveco" }))
      return null
    }

    if (!refreshPromise) {
      refreshPromise = doRefreshToken().finally(() => {
        refreshPromise = null
      })
    }
    return refreshPromise
  } catch (err) {
    await log(Effect.logWarning("ensureValidToken: unexpected error", { service: "deveco", error: err instanceof Error ? err.message : String(err) }))
    return null
  }
}

/** Test-only: reset module-level refresh state so unit tests can isolate cooldown behavior. */
export function __resetTokenRefreshState() {
  refreshPromise = null
  lastRefreshFailedAt = 0
}
