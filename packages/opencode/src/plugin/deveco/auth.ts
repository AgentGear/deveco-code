import { Effect } from "effect"

async function log(effect: Effect.Effect<void>) {
  const { AppRuntime } = await import("@/effect/app-runtime")
  return AppRuntime.runPromise(effect)
}
import { loginService } from "./login-service"
import { tokenStorage } from "./token-storage"
import { loadAccessTokenFromDisk } from "./storage"
import type { DevEcoSession, LoginResult } from "./types"

export class DevEcoAuth {
  async isLoggedIn(): Promise<boolean> {
    return loginService.isLoggedIn()
  }

  async getSession(): Promise<DevEcoSession | null> {
    const userInfo = loginService.getUserInfo()
    if (userInfo) {
      return {
        ...userInfo,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      }
    }
    const jwtToken = await tokenStorage.loadToken()
    if (jwtToken) {
      try {
        const parsed = loginService.parseJwt(jwtToken)
        if (parsed.userId) {
          // When restoring from jwtToken only (no userInfo in memory),
          // accessToken may be stored in auth.json — read it from disk
          const accessToken = loadAccessTokenFromDisk()
          return {
            userId: parsed.userId,
            userName: parsed.userName ?? "",
            accessToken,
            refreshToken: "",
            jwtToken,
            countryCode: "",
            language: "",
            isRealName: false,
            createdAt: Date.now(),
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          }
        }
      } catch (err) {
        // ignore parse errors — session may not be available from disk token
        await log(Effect.logWarning("failed to parse jwtToken when restoring session from disk", {
          service: "deveco",
          error: err instanceof Error ? err.message : String(err),
        }))
      }
    }
    return null
  }

  async login(): Promise<LoginResult> {
    return loginService.login()
  }

  cancel(): void {
    loginService.cancel()
  }

  async logout(): Promise<void> {
    return loginService.logout()
  }

  /**
   * 检查 token 是否过期
   * @param expires 过期时间戳（毫秒）
   * @returns true 表示已过期
   */
  isTokenExpired(expires: number): boolean {
    return Date.now() >= expires
  }

  /**
   * 刷新 accessToken
   * @returns 刷新成功返回新的 token 信息，失败返回 null
   */
  async refreshToken(): Promise<{ accessToken: string; refreshToken: string } | null> {
    const userInfo = this.getUserInfo()
    const jwtToken = userInfo?.jwtToken ?? (await tokenStorage.loadToken())
    if (!jwtToken) return null

    // If the JWT token itself has expired, refreshing will always fail — skip the
    // HTTP request and return null so the caller can prompt re-login.
    try {
      const parsed = loginService.parseJwt(jwtToken)
      if (parsed.exp && Date.now() >= parsed.exp * 1000) {
        await log(Effect.logWarning('refreshToken skipped: JWT token has expired, user needs to re-login', { service: 'deveco' }))
        return null
      }
    } catch {
      // JWT parse failure — let the server decide if it's still valid
    }

    const newTokens = await loginService.refreshToken(jwtToken)
    if (newTokens && userInfo) {
      userInfo.accessToken = newTokens.accessToken
      userInfo.refreshToken = newTokens.refreshToken
    }
    return newTokens
  }

  private getUserInfo() {
    return loginService.getUserInfo()
  }

  /**
   * 获取当前登录用户的 userId，供 AgreementService 使用。
   * 优先从内存中的 userInfo 取，其次从持久化的 jwtToken 解析。
   * 解析失败返回 null（不抛出错误）。
   */
  async getUserId(): Promise<string | null> {
    const userInfo = this.getUserInfo()
    if (userInfo?.userId) return userInfo.userId
    const jwtToken = await tokenStorage.loadToken()
    if (!jwtToken) return null
    try {
      const parsed = loginService.parseJwt(jwtToken)
      return parsed.userId || null
    } catch (err) {
      await log(Effect.logWarning("failed to parse jwtToken for userId", { service: "deveco", error: err instanceof Error ? err.message : String(err) }))
      return null
    }
  }
}

export const devecoAuth = new DevEcoAuth()
