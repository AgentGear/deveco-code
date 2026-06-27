import fs from "fs"
import path from "path"
import { LocalCrypto } from "@/security/local-crypto"
import { Global } from "@opencode-ai/core/global"
import { Effect } from "effect"

async function log(effect: Effect.Effect<void>) {
  const { AppRuntime } = await import("@/effect/app-runtime")
  return AppRuntime.runPromise(effect)
}
export class TokenStorage {
  private tokenFilePath: string

  constructor(configDir?: string) {
    const configPath = configDir || Global.Path.config
    this.tokenFilePath = path.join(configPath, "token.enc")
  }

  public async saveToken(token: string): Promise<void> {
    if (!token) throw new Error("Token is empty")
    const tokenData = LocalCrypto.encryptForLocalStorage(token)
    fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokenData, null, 2), { mode: 0o600 })
  }

  public async loadToken(): Promise<string | null> {
    try {
      if (!fs.existsSync(this.tokenFilePath)) return null
      const tokenData = JSON.parse(fs.readFileSync(this.tokenFilePath, "utf8"))
      if (!LocalCrypto.isEncryptedBlob(tokenData)) return null
      return LocalCrypto.decryptForLocalStorage(tokenData)
    } catch (err) {
      void this.clearToken()
      await log(
        Effect.logWarning("failed to load token, clearing token file", { service: "deveco", error: err instanceof Error ? err.message : String(err) }),
      )
      return null
    }
  }

  public async clearToken(): Promise<void> {
    try {
      if (fs.existsSync(this.tokenFilePath)) fs.unlinkSync(this.tokenFilePath)
    } catch (err) {
      throw new Error("Failed to clear token", { cause: err })
    }
  }
}

export const tokenStorage = new TokenStorage()
