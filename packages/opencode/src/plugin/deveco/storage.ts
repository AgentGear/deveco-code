import fs from "fs"
import path from "path"
import { LocalCrypto } from "@/security/local-crypto"
import { Global } from "@opencode-ai/core/global"
import { Effect } from "effect"

async function log(effect: Effect.Effect<void>) {
  const { AppRuntime } = await import("@/effect/app-runtime")
  return AppRuntime.runPromise(effect)
}

export function authFilePath() {
  return path.join(Global.Path.data, "auth.json")
}

export async function saveAuthToDisk(key: string, info: Record<string, unknown> | null) {
  try {
    let data: Record<string, unknown> = {}
    if (fs.existsSync(authFilePath())) {
      data = LocalCrypto.decryptAuthData(JSON.parse(fs.readFileSync(authFilePath(), "utf8")) as Record<string, unknown>)
    }
    if (info === null) {
      delete data[key]
    } else {
      data[key] = info
    }
    const dir = path.dirname(authFilePath())
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const encrypted = LocalCrypto.encryptAuthData(data)
    // Write to .tmp then rename for atomic persistence; prevents corrupt auth.json on crash
    const tmpPath = `${authFilePath()}.tmp`
    fs.writeFileSync(tmpPath, JSON.stringify(encrypted, null, 2), { mode: 0o600 })
    fs.renameSync(tmpPath, authFilePath())
  } catch (err) {
    await log(Effect.logError("failed to save auth to disk", { service: "deveco", key, error: err instanceof Error ? err.message : String(err) }))
  }
}

export function loadAccessTokenFromDisk(): string {
  try {
    if (!fs.existsSync(authFilePath())) return ""
    const raw = JSON.parse(fs.readFileSync(authFilePath(), "utf-8")) as Record<string, unknown>
    const data = LocalCrypto.decryptAuthData(raw) as Record<string, unknown>
    const deveco = data.deveco as Record<string, unknown> | undefined
    if (deveco?.type === "oauth" && typeof deveco.access === "string") {
      return deveco.access
    }
  } catch {
  }
  return ""
}

/**
 * Check whether auth.json has a deveco OAuth entry (type=oauth, access token present).
 * This mirrors what `deveco auth list` shows — if there's no entry, the user has not logged in.
 * The refresh token may be empty (some login flows don't store it), so we only require access.
 */
export function hasDevecoOAuthEntry(): boolean {
  try {
    if (!fs.existsSync(authFilePath())) return false
    const raw = JSON.parse(fs.readFileSync(authFilePath(), "utf-8")) as Record<string, unknown>
    const data = LocalCrypto.decryptAuthData(raw) as Record<string, unknown>
    const deveco = data.deveco as Record<string, unknown> | undefined
    return (
      deveco?.type === "oauth" && typeof deveco.access === "string" && deveco.access.length > 0
    )
  } catch {
    return false
  }
}
