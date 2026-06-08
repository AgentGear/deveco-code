import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import * as prompts from "@clack/prompts"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs"
import crypto from "crypto"
import http, { IncomingMessage, ServerResponse } from "http"
import https from "https"
import { OAUTH_DUMMY_KEY } from "@/auth"
import * as Log from "@opencode-ai/core/util/log"
import { Global } from "@opencode-ai/core/global"
import { LocalCrypto } from "@/security/local-crypto"
import { URL } from "url"
import { GlobalBus } from "@/bus/global"

const execAsync = promisify(exec)
const log = Log.create({ service: "deveco" })
const PROVIDER_ID = "deveco"
export const sessionChatIdMap = new Map<string, string>()

const authFilePath = path.join(Global.Path.data, "auth.json")

export async function saveAuthToDisk(key: string, info: Record<string, unknown>) {
  try {
    let data: Record<string, unknown> = {}
    if (fs.existsSync(authFilePath)) {
      data = LocalCrypto.decryptAuthData(JSON.parse(fs.readFileSync(authFilePath, "utf8")) as Record<string, unknown>)
    }
    data[key] = info
    const dir = path.dirname(authFilePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const encrypted = LocalCrypto.encryptAuthData(data)
    fs.writeFileSync(authFilePath, JSON.stringify(encrypted, null, 2), { mode: 0o600 })
  } catch (err) {
    log.error("failed to save auth to disk", { key, error: err instanceof Error ? err.message : String(err) })
  }
}

function loadAccessTokenFromDisk(): string {
  try {
    if (!fs.existsSync(authFilePath)) return ""
    const raw = JSON.parse(fs.readFileSync(authFilePath, "utf-8")) as Record<string, unknown>
    const data = LocalCrypto.decryptAuthData(raw) as Record<string, unknown>
    const deveco = data.deveco as Record<string, unknown> | undefined
    if (deveco?.type === "oauth" && typeof deveco.access === "string") {
      return deveco.access
    }
  } catch (err) {
    log.warn("failed to load access token from disk", { error: err instanceof Error ? err.message : String(err) })
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
    if (!fs.existsSync(authFilePath)) return false
    const raw = JSON.parse(fs.readFileSync(authFilePath, "utf-8")) as Record<string, unknown>
    const data = LocalCrypto.decryptAuthData(raw) as Record<string, unknown>
    const deveco = data.deveco as Record<string, unknown> | undefined
    return deveco?.type === "oauth"
      && typeof deveco.access === "string" && deveco.access.length > 0
  } catch (err) {
    log.warn("failed to check deveco oauth entry on disk", { error: err instanceof Error ? err.message : String(err) })
  }
  return false
}

// ============ Types ============
interface UserInfo {
  userId: string
  userName: string
  accessToken: string
  refreshToken: string
  jwtToken: string
  countryCode: string
  language: string
  isRealName: boolean
  teamList?: Map<string, string>
  currentTeamId?: string
}

interface LoginResult {
  success: boolean
  cancelled?: boolean
  userInfo?: UserInfo
  error?: string
  unsupportedRegion?: boolean
}

class LoginCancelledError extends Error {
  constructor(message: string = "Login cancelled by user") {
    super(message)
    this.name = "LoginCancelledError"
  }
}

class UnsupportedRegionError extends Error {
  constructor(message: string = "Unsupported region") {
    super(message)
    this.name = "UnsupportedRegionError"
  }
}

interface TokenCheckResponse {
  status: boolean
  userInfo?: {
    accessToken: string
    refreshToken?: string
    nationalCode: string
    realName: string
  }
}

interface JwtPayload {
  userId: string
  userName: string
  exp?: number
  iat?: number
}

interface LoginConfig {
  baseUrl: string
  authUrl: string
  tempTokenCheckUrl: string
  jwtTokenCheckUrl: string
  successRedirectUrl: string
  failedRedirectUrl: string
  appId: string
  defaultPort: number
  timeout: number
}

interface CallbackData {
  tempToken: string
  siteId: string
  quit?: string
}

interface HttpResponse {
  data: string
  statusCode: number
  headers: http.IncomingHttpHeaders
}

interface HttpRequestConfig {
  timeout?: number
  headers?: Record<string, string>
  params?: Record<string, string>
}

// ============ Constants ============
const ACCESS_TOKEN_EXPIRES_MS = 30 * 60 * 1000 // 30 minutes

const DEFAULT_CONFIG: LoginConfig = {
  baseUrl: "https://cn.devecostudio.huawei.com",
  authUrl: "console/DevEcoIDE/apply",
  tempTokenCheckUrl: "authrouter/auth/api/temptoken/check",
  jwtTokenCheckUrl: "authrouter/auth/api/jwToken/check",
  successRedirectUrl: "console/DevEcoCode/loginSuccess",
  failedRedirectUrl: "console/DevEcoCode/loginFailed",
  appId: "1008",
  defaultPort: 10101,
  timeout: 600000, // 10 minutes
}

// ============ HttpClient ============
class HttpClient {
  private defaultTimeout: number = 20000
  private defaultHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "accept-language": "zh-CN",
  }

  public async get(url: string, config?: HttpRequestConfig): Promise<HttpResponse> {
    return this.request(url, "GET", config)
  }

  public async post(url: string, config?: HttpRequestConfig): Promise<HttpResponse> {
    return this.request(url, "POST", config)
  }

  private async request(url: string, method: string, config?: HttpRequestConfig): Promise<HttpResponse> {
    const parsedUrl = new URL(url)
    const isHttps = parsedUrl.protocol === "https:"
    const httpModule = isHttps ? https : http

    const searchParams = new URLSearchParams(config?.params ?? {})
    const queryString = searchParams.toString()
    const fullUrl = queryString ? `${url}?${queryString}` : url

    const headers = {
      ...this.defaultHeaders,
      ...(config?.headers || {}),
    }

    return new Promise((resolve, reject) => {
      const options: http.RequestOptions | https.RequestOptions = {
        method,
        headers,
        timeout: config?.timeout ?? this.defaultTimeout,
      }

      const req = httpModule.request(fullUrl, options, (res) => {
        let data = ""
        res.on("data", (chunk) => {
          data += chunk
        })
        res.on("end", () => {
          resolve({
            data,
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
          })
        })
      })

      req.on("error", reject)
      req.on("timeout", () => {
        req.destroy()
        reject(new Error("Request timeout"))
      })

      if (method === "POST" && config?.params) {
        req.write(JSON.stringify(config.params))
      }

      req.end()
    })
  }

  public parseJson(response: HttpResponse): TokenCheckResponse {
    return JSON.parse(response.data) as TokenCheckResponse
  }
}

const httpClient = new HttpClient()

class TokenStorage {
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
      log.warn("failed to load token, clearing token file", { error: err instanceof Error ? err.message : String(err) })
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

const tokenStorage = new TokenStorage()

// ============ LocalAuthServer ============
class LocalAuthServer {
  private server: http.Server | null = null
  private port: number
  private clientSecret: string
  private callbackPath: string = "/callback"
  private resolveCallback: ((value: CallbackData) => void) | null = null
  private rejectCallback: ((reason: Error) => void) | null = null
  private timeoutId: ReturnType<typeof setTimeout> | null = null

  constructor(port: number, clientSecret: string, private baseUrl: string, private successRedirectUrl: string, private failedRedirectUrl: string) {
    this.port = port
    this.clientSecret = clientSecret
  }

  public async start(): Promise<number> {
    const portsToTry = [this.port, 34567, 34568, 34569, 34570]

    for (const port of portsToTry) {
      try {
        const actualPort = await this.tryPort(port)
        this.port = actualPort
        return actualPort
      } catch {
        if (port === portsToTry[portsToTry.length - 1]) {
          log.error("all auth server ports are in use", { ports: portsToTry })
          throw new Error("All ports are in use. Please free up a port or close other DevEco Code instances.")
        }
      }
    }

    throw new Error("Failed to start server")
  }

  private tryPort(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this.handleRequest(req, res)
      })
      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          reject(new Error("Port is already in use"))
        } else {
          reject(err)
        }
      })
      server.listen(port, "127.0.0.1", () => {
        this.server = server
        resolve(port)
      })
    })
  }

  public async waitForCallback(timeout: number = 30000): Promise<CallbackData> {
    return new Promise((resolve, reject) => {
      this.resolveCallback = (value: CallbackData) => {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId)
          this.timeoutId = null
        }
        resolve(value)
      }
      this.rejectCallback = (reason: Error) => {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId)
          this.timeoutId = null
        }
        reject(reason)
      }
      this.timeoutId = setTimeout(() => {
        this.timeoutId = null
        this.rejectCallback?.(new Error("Callback timeout"))
      }, timeout)
    })
  }

  public cancel(): void {
    if (this.rejectCallback) {
      this.rejectCallback(new LoginCancelledError("Login cancelled by user"))
      this.rejectCallback = null
      this.resolveCallback = null
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  public async stop(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve()
        return
      }
      this.server.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const host = req.headers.host || `localhost:${this.port}`
    const url = new URL(req.url ?? "", `http://${host}`)

    if (url.pathname !== this.callbackPath) {
      res.writeHead(404)
      res.end("Not Found")
      return
    }

    try {
      const urlParams = url.searchParams

      if (req.method === "POST") {
        let body = ""
        req.on("data", (chunk) => {
          body += chunk.toString()
        })
        req.on("end", () => {
          this.handleCallbackRequest(req, res, urlParams, body)
        })
      } else {
        this.handleCallbackRequest(req, res, urlParams, "")
      }
    } catch (err) {
      res.writeHead(500)
      res.end("Internal Server Error")
      log.error("local auth server request error", { error: err instanceof Error ? err.message : String(err) })
      this.rejectCallback?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  private handleCallbackRequest(
    _req: IncomingMessage,
    res: ServerResponse,
    urlParams: URLSearchParams,
    body: string,
  ): void {
    try {
      let params: URLSearchParams
      if (body && body.trim()) {
        params = new URLSearchParams(body)
      } else {
        params = urlParams
      }

      const code = params.get("code")
      const tempToken = params.get("tempToken")
      const siteId = params.get("siteId")
      const quit = params.get("quit")

      // Verify code matches the clientSecret we generated for this session
      // If code doesn't match, silently ignore the request and keep waiting for the real callback
      if (!code || code !== this.clientSecret) {
        log.warn("login callback: code mismatch or missing, ignoring", { hasCode: !!code })
        return
      }

      if (quit === "true" || quit === "access_denied") {
        log.info("login callback: user cancelled", { quit })
        this.rejectCallback?.(
          new LoginCancelledError(
            quit === "access_denied" ? "Access denied by user" : "Login cancelled by user",
          ),
        )
        res.writeHead(302, {
          Location: `${this.baseUrl}/${this.failedRedirectUrl}`,
        })
        res.end()
        return
      }

      if (!tempToken || !siteId) {
        log.error("login callback: missing tempToken or siteId", { tempToken: !!tempToken, siteId: !!siteId })
        this.rejectCallback?.(new Error("Login cancelled by user"))
        res.writeHead(302, {
          Location: `${this.baseUrl}/${this.failedRedirectUrl}`,
        })
        res.end()
        return
      }

      if (siteId !== "1") {
        log.error("login callback: unsupported region", { siteId })
        this.rejectCallback?.(new UnsupportedRegionError("Unsupported region"))
        res.writeHead(302, {
          Location: `${this.baseUrl}/${this.failedRedirectUrl}`,
        })
        res.end()
        return
      }

      const callbackData: CallbackData = {
        tempToken,
        siteId,
        quit: quit ?? undefined,
      }

      this.resolveCallback?.(callbackData)

      res.writeHead(302, {
        Location: `${this.baseUrl}/${this.successRedirectUrl}`,
      })
      res.end()
    } catch (err) {
      res.writeHead(500)
      res.end("Internal Server Error")
      log.error("local auth server callback error", { error: err instanceof Error ? err.message : String(err) })
      this.rejectCallback?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  public getPort(): number {
    return this.port
  }
}

// ============ LoginService ============
class LoginService {
  private config: LoginConfig
  private server: LocalAuthServer | null = null
  private userInfo: UserInfo | null = null

  constructor(config?: Partial<LoginConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  public async login(): Promise<LoginResult> {
    try {
      const clientSecret = this.generateClientSecret()

      this.server = new LocalAuthServer(this.config.defaultPort, clientSecret, this.config.baseUrl, this.config.successRedirectUrl, this.config.failedRedirectUrl)
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
        log.info("login cancelled by user")
        return {
          success: false,
          cancelled: true,
          error: err.message,
        }
      }
      if (err instanceof UnsupportedRegionError) {
        log.error("login failed: unsupported region", { error: err.message })
        return {
          success: false,
          unsupportedRegion: true,
          error: "Sorry, only China site accounts are currently supported",
        }
      }
      log.error("login failed", { error: err instanceof Error ? err.message : String(err) })
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
    // Also clear deveco oauth entry from auth.json so loadAccessTokenFromDisk() returns ""
    try {
      await saveAuthToDisk("deveco", {})
      // Remove the empty deveco key entirely
      if (fs.existsSync(authFilePath)) {
        const raw = JSON.parse(fs.readFileSync(authFilePath, "utf8")) as Record<string, unknown>
        const data = LocalCrypto.decryptAuthData(raw) as Record<string, unknown>
        delete data.deveco
        const dir = path.dirname(authFilePath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const encrypted = LocalCrypto.encryptAuthData(data)
        fs.writeFileSync(authFilePath, JSON.stringify(encrypted, null, 2), { mode: 0o600 })
      }
    } catch (err) {
      log.warn("failed to clear auth.json deveco entry during logout", { error: err })
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
      log.error("failed to open login page in browser", { command, error: err instanceof Error ? err.message : String(err) })
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
      log.error("failed to get jwtToken", { statusCode: response.statusCode })
      throw new Error(`Failed to get jwtToken: ${response.statusCode}`)
    }

    const jwtToken = response.data.trim()

    if (jwtToken.split(".").length !== 3) {
      log.error("invalid jwtToken format received", { tokenLength: jwtToken.length })
      throw new Error(`Invalid jwtToken format`)
    }

    return jwtToken
  }

  private async getUserInfoFromJwt(jwtToken: string): Promise<UserInfo> {
    const tokenInfo = await this.checkJwtToken(jwtToken)

    if (!tokenInfo.status || !tokenInfo.userInfo) {
      log.error("invalid jwtToken: missing userInfo", { status: tokenInfo.status })
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
      log.error("failed to check jwtToken", { statusCode: response.statusCode })
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
   * @returns 新的 accessToken 和 refreshToken，如果刷新失败返回 null
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
        log.error(`refreshToken failed: HTTP ${response.statusCode}`, { url })
        return null
      }

      const result = httpClient.parseJson(response)
      if (!result.status || !result.userInfo) {
        log.error(`refreshToken failed: invalid response`, { status: result.status, hasUserInfo: !!result.userInfo, url })
        return null
      }

      return {
        accessToken: result.userInfo.accessToken,
        refreshToken: result.userInfo.refreshToken ?? "",
      }
    } catch (err) {
      log.error(`refreshToken error: ${err}`, { url })
      return null
    }
  }
}

// ============ Singleton instance ============
const loginService = new LoginService()

// ============ Public API ============
export interface DevEcoSession {
  userId: string
  userName: string
  accessToken: string
  refreshToken: string
  jwtToken: string
  countryCode: string
  language: string
  isRealName: boolean
  createdAt: number
  expiresAt: number
}

class DevEcoAuth {
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
          log.warn("failed to parse jwtToken when restoring session from disk", { error: err instanceof Error ? err.message : String(err) })
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
    return loginService.refreshToken(jwtToken)
  }

  private getUserInfo(): UserInfo | null {
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
      log.warn("failed to parse jwtToken for userId", { error: err instanceof Error ? err.message : String(err) })
      return null
    }
  }
}

export const devecoAuth = new DevEcoAuth()

export { ACCESS_TOKEN_EXPIRES_MS }

export async function requireLogin(): Promise<boolean> {
  if (await devecoAuth.isLoggedIn()) return true

  prompts.intro("Get started with DevEco Code")

  const choice = await prompts.select({
    message: "How would you like to continue?",
    options: [
      { label: "Login", value: "login", hint: "Sign in with your Huawei account" },
      { label: "Don't use", value: "skip", hint: "Exit DevEco Code" },
    ],
  })

  if (prompts.isCancel(choice)) {
    prompts.outro("Goodbye!")
    return false
  }

  if (choice === "skip") {
    prompts.outro("Goodbye!")
    return false
  }

  const spinner = prompts.spinner()
  spinner.start("Starting login process...")

  try {
    spinner.message("Opening browser for login...")

    const result = await devecoAuth.login()

    if (!result.success) {
      spinner.stop("Login failed")
      if (result.cancelled) {
        // 用户在浏览器登录页面取消了登录，直接退出 deveco
        prompts.outro("Goodbye!")
        process.exit(1)
      }
      if (result.unsupportedRegion) {
        log.error("login failed: unsupported region")
        prompts.log.error("Sorry, only China site accounts are currently supported")
      } else {
        log.error("login failed", { error: result.error })
        prompts.log.error(result.error || "An error occurred during login")
      }
      prompts.outro("Please try again later")
      return false
    }

    spinner.stop("Login successful!")
    prompts.log.success(`Logged in as ${result.userInfo?.userName}`)

    // Save tokens to Auth using oauth type with expiration
    const accessToken = result.userInfo?.accessToken || ""
    const refreshToken = result.userInfo?.refreshToken || ""
    if (accessToken) {
      await saveAuthToDisk("deveco", {
        type: "oauth",
        access: accessToken,
        refresh: refreshToken,
        expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
      })
    }

    prompts.outro("Welcome to DevEco Code!")
    return true
  } catch (error) {
    spinner.stop("Login failed")
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    log.error("login exception in requireLogin", { error: errorMessage })
    prompts.log.error(errorMessage)
    prompts.outro("Please try again later")
    return false
  }
}

// ============ Plugin ============
export async function DevEcoAuthPlugin(_input: PluginInput): Promise<Hooks> {
  return {
    auth: {
      provider: PROVIDER_ID,
      async loader(getAuth, _provider) {
        const info = await getAuth()
        if (!info) return {}

        return {
          apiKey: OAUTH_DUMMY_KEY,
          async fetch(requestInput: RequestInfo | URL, init?: RequestInit) {
            if (init?.headers) {
              if (init.headers instanceof Headers) {
                init.headers.delete("authorization")
                init.headers.delete("Authorization")
              } else if (Array.isArray(init.headers)) {
                init.headers = init.headers.filter(([key]) => key.toLowerCase() !== "authorization")
              } else {
                delete init.headers["authorization"]
                delete init.headers["Authorization"]
              }
            }

            const currentAuth = await getAuth()
            if (currentAuth?.type === "oauth") {
              if (!currentAuth.access || currentAuth.expires < Date.now()) {
                const newTokens = await devecoAuth.refreshToken()
                if (newTokens?.accessToken) {
                  await saveAuthToDisk("deveco", {
                    type: "oauth",
                    access: newTokens.accessToken,
                    refresh: newTokens.refreshToken,
                    expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
                  })
                  currentAuth.access = newTokens.accessToken
                } else {
                  log.error("DevEco Code token refresh failed, user needs to re-login")
                  GlobalBus.emit("event", {
                    directory: "global",
                    payload: {
                      type: "auth.token_refresh_failed",
                      properties: {
                        providerID: "deveco",
                        message: "Token refresh failed. Please re-login to DevEco Code.",
                      },
                    },
                  })
                  // 返回 401 错误响应，阻止使用过期 token 发送请求
                  return new Response(JSON.stringify({ error: "Token refresh failed. Please re-login to DevEco Code." }), {
                    status: 401,
                    statusText: "Unauthorized",
                    headers: { "Content-Type": "application/json" },
                  })
                }
              }
            }

            const headers = new Headers()
            if (init?.headers) {
              if (init.headers instanceof Headers) {
                init.headers.forEach((value, key) => headers.set(key, value))
              } else if (Array.isArray(init.headers)) {
                for (const [key, value] of init.headers) {
                  if (value !== undefined) headers.set(key, String(value))
                }
              } else {
                for (const [key, value] of Object.entries(init.headers)) {
                  if (value !== undefined) headers.set(key, String(value))
                }
              }
            }

            if (currentAuth?.type === "oauth" && currentAuth.access) {
              headers.set("authorization", `Bearer ${currentAuth.access}`)
            }

            headers.set("lang", "en")

            const sessionId = headers.get("x-deveco-session") || headers.get("x-session-affinity")
            const chatId = (sessionId && sessionChatIdMap.get(sessionId)) || crypto.randomUUID().replace(/-/g, "")
            headers.set("Chat-Id", chatId)
            if (sessionId) {
              headers.set("Session-Id", sessionId)
            }

            // DevEco Code API requires /no-stream in URL path for non-streaming requests
            // e.g. /v2/chat/completions → /v2/no-stream/chat/completions
            let finalInput: RequestInfo | URL = requestInput
            if (typeof init?.body === "string") {
              try {
                const body = JSON.parse(init.body)
                if (body?.stream !== true) {
                  const url = requestInput instanceof URL
                    ? new URL(requestInput.toString())
                    : new URL(typeof requestInput === "string" ? requestInput : requestInput.url)
                  url.pathname = url.pathname.replace(/\/$/, "").replace(/\/chat\/completions$/, "/no-stream/chat/completions")
                  finalInput = url
                }
              } catch {
                log.error("Failed to rewrite URL for non-streaming request", { requestInput: String(requestInput) })
              }
            }

            return fetch(finalInput, {
              ...init,
              headers,
            })
          },
        }
      },
      methods: [
        {
          type: "oauth",
          label: "Login with Huawei DevEco Account",
          async authorize() {
            return {
              url: "",
              instructions: "Opening browser for login...",
              method: "auto" as const,
              async callback() {
                const result = await devecoAuth.login()

                if (!result.success) {
                  process.exit(1)
                  if (result.unsupportedRegion) {
                    return { type: "failed" as const, error: "Sorry, only China site accounts are currently supported" }
                  }
                  return { type: "failed" as const }
                }

                const access = result.userInfo?.accessToken || ""
                const refresh = result.userInfo?.refreshToken || ""

                return {
                  type: "success" as const,
                  provider: PROVIDER_ID,
                  access,
                  refresh,
                  expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
                }
              },
            }
          },
        },
      ],
    },
  }
}
