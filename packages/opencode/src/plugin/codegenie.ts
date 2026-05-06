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

const execAsync = promisify(exec)
const log = Log.create({ service: "codegenie" })
const PROVIDER_ID = "codegenie"
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
  } catch {}
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
}

class LoginCancelledError extends Error {
  constructor(message: string = "Login cancelled by user") {
    super(message)
    this.name = "LoginCancelledError"
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
  countryCode?: string
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
  baseUrl: "https://devecostudio.huawei.com",
  authUrl: "console/DevEcoIDE/apply",
  tempTokenCheckUrl: "authrouter/auth/api/temptoken/check",
  jwtTokenCheckUrl: "authrouter/auth/api/jwToken/check",
  successRedirectUrl: "console/DevEcoCodeGenie/loginSuccess",
  failedRedirectUrl: "console/DevEcoCodeGenie/loginFailed",
  appId: "1008",
  defaultPort: 10101,
  timeout: 600000, // 10 minutes
  countryCode: "CN",
}

const CountryCode = {
  CHINA: "CN",
  RUSSIA: "RU",
  SINGAPORE: "SG",
  EUROPE: "EU",
} as const

const LanguageCode = {
  CHINA: "zh_CN",
  RUSSIA: "ru_RU",
  EUROPE: "de_DE",
} as const

const SiteId = {
  CHINA: "1",
  SINGAPORE: "5",
  EUROPE: "7",
  RUSSIA: "8",
} as const

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
    } catch {
      void this.clearToken()
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
          throw new Error("All ports are in use. Please free up a port or close other CodeGenie instances.")
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
      server.listen(port, "0.0.0.0", () => {
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

      if (quit === "true" || quit === "access_denied") {
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

      if (code !== this.clientSecret) {
        this.rejectCallback?.(new LoginCancelledError("Login cancelled or invalid callback"))
        res.writeHead(302, {
          Location: `${this.baseUrl}/${this.failedRedirectUrl}`,
        })
        res.end()
        return
      }

      if (!tempToken || !siteId) {
        this.rejectCallback?.(new Error("Login cancelled by user"))
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

      this.server = new LocalAuthServer(this.config.defaultPort, clientSecret, this.getRegionalizedBaseUrl(), this.config.successRedirectUrl, this.config.failedRedirectUrl)
      await this.server.start()

      await this.openLoginPage(this.server.getPort(), clientSecret)

      const callbackData = await this.server.waitForCallback(this.config.timeout)

      const jwtToken = await this.getJwtToken(callbackData.tempToken, callbackData.siteId)

      const userInfo = await this.getUserInfoFromJwt(jwtToken)

      await tokenStorage.saveToken(jwtToken)

      this.userInfo = userInfo

      return {
        success: true,
        userInfo,
      }
    } catch (err) {
      if (err instanceof LoginCancelledError) {
        return {
          success: false,
          cancelled: true,
          error: err.message,
        }
      }
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
  }

  private generateClientSecret(): string {
    return crypto.randomUUID().replace(/-/g, "")
  }

  private getRegionalizedBaseUrl(): string {
    const countryCode = this.config.countryCode?.toUpperCase()

    if (countryCode === "CN") {
      return "https://cn.devecostudio.huawei.com"
    }
    return this.config.baseUrl
  }

  private async openLoginPage(port: number, clientSecret: string): Promise<void> {
    const regionalizedBaseUrl = this.getRegionalizedBaseUrl()
    const loginUrl = `${regionalizedBaseUrl}/${this.config.authUrl}?port=${port}&appid=${this.config.appId}&code=${clientSecret}`

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
      throw new Error("Failed to open login page", { cause: err })
    }
  }

  private async getJwtToken(tempToken: string, siteId: string): Promise<string> {
    const actualTempToken = tempToken.split("&")[0]

    const countryCode = this.getCountryCodeBySiteId(siteId)

    const params = {
      tempToken: actualTempToken,
      site: countryCode,
      version: "1.0.0",
      appid: this.config.appId,
    }

    const regionalizedBaseUrl = this.getRegionalizedBaseUrl()
    const url = `${regionalizedBaseUrl}/${this.config.tempTokenCheckUrl}`
    const response = await httpClient.get(url, { params })

    if (response.statusCode !== 200) {
      throw new Error(`Failed to get jwtToken: ${response.statusCode}`)
    }

    const jwtToken = response.data.trim()

    if (jwtToken.split(".").length !== 3) {
      throw new Error(`Invalid jwtToken format`)
    }

    return jwtToken
  }

  private async getUserInfoFromJwt(jwtToken: string): Promise<UserInfo> {
    const tokenInfo = await this.checkJwtToken(jwtToken)

    if (!tokenInfo.status || !tokenInfo.userInfo) {
      throw new Error("Invalid jwtToken: missing userInfo")
    }

    const JwtPayload = this.parseJwt(jwtToken)

    const userInfo: UserInfo = {
      userId: JwtPayload.userId,
      userName: JwtPayload.userName,
      accessToken: tokenInfo.userInfo.accessToken,
      refreshToken: tokenInfo.userInfo.refreshToken ?? "",
      jwtToken: jwtToken,
      countryCode: tokenInfo.userInfo.nationalCode,
      language: this.getLanguageByCountryCode(tokenInfo.userInfo.nationalCode),
      isRealName: tokenInfo.userInfo.realName === "true",
    }

    return userInfo
  }

  private async checkJwtToken(jwtToken: string): Promise<TokenCheckResponse> {
    const headers = {
      refresh: "false",
      jwtToken: jwtToken,
    }

    const regionalizedBaseUrl = this.getRegionalizedBaseUrl()
    const url = `${regionalizedBaseUrl}/${this.config.jwtTokenCheckUrl}`
    const response = await httpClient.get(url, { headers })

    if (response.statusCode !== 200) {
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

  private getCountryCodeBySiteId(siteId: string): string {
    switch (siteId) {
      case SiteId.CHINA:
        return CountryCode.CHINA
      case SiteId.SINGAPORE:
        return CountryCode.SINGAPORE
      case SiteId.EUROPE:
        return CountryCode.EUROPE
      case SiteId.RUSSIA:
        return CountryCode.RUSSIA
      default:
        return CountryCode.CHINA
    }
  }

  private getLanguageByCountryCode(countryCode: string): string {
    switch (countryCode) {
      case CountryCode.CHINA:
        return LanguageCode.CHINA
      case CountryCode.RUSSIA:
        return LanguageCode.RUSSIA
      case CountryCode.EUROPE:
        return LanguageCode.EUROPE
      default:
        return LanguageCode.CHINA
    }
  }

  /**
   * 刷新 accessToken
   * @param jwtToken 当前的 jwtToken
   * @returns 新的 accessToken 和 refreshToken，如果刷新失败返回 null
   */
  async refreshToken(jwtToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    const regionalizedBaseUrl = this.getRegionalizedBaseUrl()
    const url = `${regionalizedBaseUrl}/${this.config.jwtTokenCheckUrl}`
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
export interface CodeGenieSession {
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

class CodeGenieAuth {
  async isLoggedIn(): Promise<boolean> {
    return loginService.isLoggedIn()
  }

  async getSession(): Promise<CodeGenieSession | null> {
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
          return {
            userId: parsed.userId,
            userName: parsed.userName ?? "",
            accessToken: "",
            refreshToken: "",
            jwtToken,
            countryCode: "",
            language: "",
            isRealName: false,
            createdAt: Date.now(),
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    return null
  }

  async login(): Promise<LoginResult> {
    return loginService.login()
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
}

export const codegenieAuth = new CodeGenieAuth()

export { ACCESS_TOKEN_EXPIRES_MS }

export async function requireLogin(): Promise<boolean> {
  if (await codegenieAuth.isLoggedIn()) return true

  prompts.intro("Welcome to CodeGenie")

  const choice = await prompts.select({
    message: "How would you like to continue?",
    options: [
      { label: "Login", value: "login", hint: "Sign in with your Huawei account" },
      { label: "Don't use", value: "skip", hint: "Exit CodeGenie" },
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

    const result = await codegenieAuth.login()

    if (!result.success) {
      spinner.stop("Login failed")
      prompts.log.error(result.error || "An error occurred during login")
      prompts.outro("Please try again later")
      return false
    }

    spinner.stop("Login successful!")
    prompts.log.success(`Logged in as ${result.userInfo?.userName}`)

    // Save tokens to Auth using oauth type with expiration
    const accessToken = result.userInfo?.accessToken || ""
    const refreshToken = result.userInfo?.refreshToken || ""
    if (accessToken) {
      await saveAuthToDisk("codegenie", {
        type: "oauth",
        access: accessToken,
        refresh: refreshToken,
        expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
      })
    }

    prompts.outro("Welcome to CodeGenie!")
    return true
  } catch (error) {
    spinner.stop("Login failed")
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    prompts.log.error(errorMessage)
    prompts.outro("Please try again later")
    return false
  }
}

// ============ Plugin ============
export async function CodegenieAuthPlugin(_input: PluginInput): Promise<Hooks> {
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
                const newTokens = await codegenieAuth.refreshToken()
                if (newTokens) {
                  await saveAuthToDisk("codegenie", {
                    type: "oauth",
                    access: newTokens.accessToken,
                    refresh: newTokens.refreshToken,
                    expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
                  })
                  currentAuth.access = newTokens.accessToken
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

            const sessionId = headers.get("x-codegenie-session") || headers.get("x-session-affinity")
            const chatId = (sessionId && sessionChatIdMap.get(sessionId)) || crypto.randomUUID().replace(/-/g, "")
            headers.set("Chat-Id", chatId)
            if (sessionId) {
              headers.set("Session-Id", sessionId)
            }

            return fetch(requestInput, {
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
                const spinner = prompts.spinner()
                spinner.start("Starting login process...")

                try {
                  const result = await codegenieAuth.login()

                  if (!result.success) {
                    if (result.cancelled) {
                      spinner.stop("Login cancelled")
                      prompts.log.warn("You cancelled the login. You can try again anytime.")
                      return { type: "failed" as const }
                    }
                    spinner.stop("Login failed")
                    prompts.log.error(result.error || "Login failed")
                    return { type: "failed" as const }
                  }

                  spinner.stop("Login successful!")
                  prompts.log.success(`Logged in as ${result.userInfo?.userName}`)

                  const access = result.userInfo?.accessToken || ""
                  const refresh = result.userInfo?.refreshToken || ""

                  return {
                    type: "success" as const,
                    provider: PROVIDER_ID,
                    access,
                    refresh,
                    expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
                  }
                } catch (error) {
                  spinner.stop("Login failed")
                  const errorMessage = error instanceof Error ? error.message : "Unknown error"
                  prompts.log.error(errorMessage)
                  return { type: "failed" as const }
                }
              },
            }
          },
        },
      ],
    },
  }
}
