import { exec } from "child_process"
import { promisify } from "util"
import crypto from "crypto"
import { Effect } from "effect"

async function log(effect: Effect.Effect<void>) {
  const { AppRuntime } = await import("@/effect/app-runtime")
  return AppRuntime.runPromise(effect)
}
import { LoginCancelledError, UnsupportedRegionError } from "./errors"
import { httpClient } from "./http-client"
import { LocalAuthServer } from "./local-auth-server"
import { tokenStorage } from "./token-storage"
import { saveAuthToDisk } from "./storage"
import type { JwtPayload, LoginConfig, LoginResult, TokenCheckResponse, UserInfo } from "./types"
import { DEFAULT_CONFIG } from "./types"

const execAsync = promisify(exec)

export class LoginService {
  private config: LoginConfig
  private server: LocalAuthServer | null = null
  private userInfo: UserInfo | null = null

  constructor(config?: Partial<LoginConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  public async login(): Promise<LoginResult> {
    try {
      const clientSecret = this.generateClientSecret()

      this.server = new LocalAuthServer(
        this.config.defaultPort,
        clientSecret,
        this.config.baseUrl,
        this.config.successRedirectUrl,
        this.config.failedRedirectUrl,
      )
      await this.server.start()

      // Set up the callback promise BEFORE opening the browser page so that
      // resolveCallback/rejectCallback are ready the instant the server starts
      // receiving requests.  If the browser redirects back quickly (e.g. cached
      // OAuth session, auto-approve), the callback must not arrive before the
      // promise handlers are installed — otherwise ?. silently drops it.
      const callbackPromise = this.server.waitForCallback(this.config.timeout)

      await this.openLoginPage(this.server.getPort(), clientSecret)

      const callbackData = await callbackPromise

      const jwtToken = await this.getJwtToken(callbackData.tempToken)

      const userInfo = await this.getUserInfoFromJwt(jwtToken)

      await tokenStorage.saveToken(jwtToken)

      this.userInfo = userInfo

      return {
        success: true,
        userInfo,
      }
    } catch (err) {
      if (err instanceof LoginCancelledError) {
        await log(Effect.logInfo("login cancelled by user", { service: "deveco" }))
        return {
          success: false,
          cancelled: true,
          error: err.message,
        }
      }
      if (err instanceof UnsupportedRegionError) {
        await log(Effect.logError("login failed: unsupported region", { service: "deveco", error: err.message }))
        return {
          success: false,
          unsupportedRegion: true,
          error: "Sorry, only China site accounts are currently supported",
        }
      }
      await log(Effect.logError("login failed", { service: "deveco", error: err instanceof Error ? err.message : String(err) }))
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }
    } finally {
      if (this.server) {
        await this.server.stop()
        this.server = null
      }
    }
  }

  public cancel(): void {
    if (this.server) {
      this.server.cancel()
    }
  }

  public async isLoggedIn(): Promise<boolean> {
    if (this.userInfo) {
      return true
    }
    const token = await tokenStorage.loadToken()
    return token !== null
  }

  public getUserInfo(): UserInfo | null {
    return this.userInfo
  }

  public async logout(): Promise<void> {
    await tokenStorage.clearToken()
    this.userInfo = null
    try {
      await saveAuthToDisk("deveco", null)
    } catch (err) {
      await log(Effect.logWarning("failed to clear auth.json deveco entry during logout", { service: "deveco", error: String(err) }))
    }
  }

  private generateClientSecret(): string {
    return crypto.randomUUID().replace(/-/g, "")
  }

  private async openLoginPage(port: number, clientSecret: string): Promise<void> {
    const loginUrl = `${this.config.baseUrl}/${this.config.authUrl}?port=${port}&appid=${this.config.appId}&code=${clientSecret}`

    const platform = process.platform
    let command: string
    switch (platform) {
      case "win32":
        command = `start "" "${loginUrl}"`
        break
      case "darwin":
        command = `open "${loginUrl}"`
        break
      default:
        command = `xdg-open "${loginUrl}"`
        break
    }
    try {
      await execAsync(command)
    } catch (err) {
      await log(Effect.logError("failed to open login page in browser", {
        service: "deveco",
        command,
        error: err instanceof Error ? err.message : String(err),
      }))
      throw new Error("Failed to open login page", { cause: err })
    }
  }

  private async getJwtToken(tempToken: string): Promise<string> {
    const actualTempToken = tempToken.split("&")[0]

    const params = {
      tempToken: actualTempToken,
      site: "CN",
      version: "1.0.0",
      appid: this.config.appId,
    }

    const url = `${this.config.baseUrl}/${this.config.tempTokenCheckUrl}`
    const response = await httpClient.get(url, { params })

    if (response.statusCode !== 200) {
      await log(Effect.logError("failed to get jwtToken", { service: "deveco", statusCode: response.statusCode }))
      throw new Error(`Failed to get jwtToken: ${response.statusCode}`)
    }

    const jwtToken = response.data.trim()

    if (jwtToken.split(".").length !== 3) {
      await log(Effect.logError("invalid jwtToken format received", { service: "deveco", tokenLength: jwtToken.length }))
      throw new Error(`Invalid jwtToken format`)
    }

    return jwtToken
  }

  private async getUserInfoFromJwt(jwtToken: string): Promise<UserInfo> {
    const tokenInfo = await this.checkJwtToken(jwtToken)

    if (!tokenInfo.status || !tokenInfo.userInfo) {
      await log(Effect.logError("invalid jwtToken: missing userInfo", { service: "deveco", status: tokenInfo.status }))
      throw new Error("Invalid jwtToken: missing userInfo")
    }

    const JwtPayload = this.parseJwt(jwtToken)

    const userInfo: UserInfo = {
      userId: JwtPayload.userId,
      userName: JwtPayload.userName,
      accessToken: tokenInfo.userInfo.accessToken,
      refreshToken: tokenInfo.userInfo.refreshToken ?? "",
      jwtToken: jwtToken,
      countryCode: "CN",
      language: "zh_CN",
      isRealName: tokenInfo.userInfo.realName === "true",
    }

    return userInfo
  }

  private async checkJwtToken(jwtToken: string): Promise<TokenCheckResponse> {
    const headers = {
      refresh: "false",
      jwtToken: jwtToken,
    }

    const url = `${this.config.baseUrl}/${this.config.jwtTokenCheckUrl}`
    const response = await httpClient.get(url, { headers })

    if (response.statusCode !== 200) {
      await log(Effect.logError("failed to check jwtToken", { service: "deveco", statusCode: response.statusCode }))
      throw new Error(`Failed to check jwtToken: ${response.statusCode}`)
    }

    const result = httpClient.parseJson(response)
    return result
  }

  public parseJwt(token: string): JwtPayload {
    const parts = token.split(".")
    if (parts.length !== 3) {
      throw new Error(`Invalid jwtToken format`)
    }

    const payload = parts[1]
    const base64Url = payload.replace(/-/g, "+").replace(/_/g, "/")
    const base64 = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), "=")
    const json = Buffer.from(base64, "base64").toString("utf8")

    const parsed = JSON.parse(json)
    return {
      userId: parsed.userId ?? "",
      userName: parsed.userName ?? "",
      exp: parsed.exp,
      iat: parsed.iat,
    }
  }

  /**
   * 刷新 accessToken
   * @param jwtToken 当前的 jwtToken
   * @returns 新的 accessToken 和 refreshToken，如果失败返回 null
   */
  async refreshToken(jwtToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    const url = `${this.config.baseUrl}/${this.config.jwtTokenCheckUrl}`
    try {
      const headers: Record<string, string> = {
        refresh: "true",
        jwtToken: jwtToken,
      }

      const response = await httpClient.get(url, { headers })

      if (response.statusCode !== 200) {
        await log(Effect.logError(`refreshToken failed: HTTP ${response.statusCode}`, { service: "deveco", url }))
        return null
      }

      const result = httpClient.parseJson(response)
      if (!result.status || !result.userInfo) {
        await log(Effect.logError(`refreshToken failed: invalid response`, {
          service: "deveco",
          status: result.status,
          hasUserInfo: !!result.userInfo,
          url,
        }))
        return null
      }

      return {
        accessToken: result.userInfo.accessToken,
        refreshToken: result.userInfo.refreshToken ?? "",
      }
    } catch (err) {
      await log(Effect.logError(`refreshToken error: ${err}`, { service: "deveco", url }))
      return null
    }
  }
}

export const loginService = new LoginService()
