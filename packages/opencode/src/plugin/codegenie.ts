import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import * as prompts from "@clack/prompts"
import { exec } from "child_process"
import { promisify } from "util"
import { homedir } from "os"
import path from "path"
import fs from "fs"
import crypto from "crypto"
import http, { IncomingMessage, ServerResponse } from "http"
import https from "https"
import { Auth, OAUTH_DUMMY_KEY } from "@/auth"
import { URL } from "url"

const execAsync = promisify(exec)
const PROVIDER_ID = "codegenie"

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
  userInfo?: UserInfo
  error?: string
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
      ...(config?.headers ?? {}),
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

  public parseJson<T>(response: HttpResponse): T {
    return JSON.parse(response.data) as T
  }
}

const httpClient = new HttpClient()

// ============ TokenStorage ============
class TokenStorage {
  private keyFilePath: string
  private algorithm: string = "aes-128-gcm"
  private keyLength: number = 16
  private ivLength: number = 12

  constructor(configDir?: string) {
    const configPath = configDir || path.join(homedir(), ".config", "codegenie")
    this.keyFilePath = path.join(configPath, ".token_key")
  }

  private getKey(): Buffer {
    try {
      const keyData = fs.readFileSync(this.keyFilePath)
      return keyData
    } catch (err) {
      const key = crypto.randomBytes(this.keyLength)

      const dir = path.dirname(this.keyFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
      }

      fs.writeFileSync(this.keyFilePath, key, { mode: 0o600 })
      return key
    }
  }

  private encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
    const key = this.getKey()
    const iv = crypto.randomBytes(this.ivLength)

    const cipher = crypto.createCipheriv(this.algorithm, key, iv) as crypto.CipherGCM

    let encrypted = cipher.update(plaintext, "utf8", "hex")
    encrypted += cipher.final("hex")

    const authTag = cipher.getAuthTag()

    return {
      encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    }
  }

  private decrypt(encrypted: string, ivHex: string, authTagHex: string): string {
    const key = this.getKey()
    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv) as crypto.DecipherGCM
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  }

  public async saveToken(token: string): Promise<void> {
    if (!token) {
      throw new Error("Token is empty")
    }

    const { encrypted, iv, authTag } = this.encrypt(token)

    const configPath = path.dirname(this.keyFilePath)
    const tokenFilePath = path.join(configPath, "token.enc")
    const tokenData = {
      encrypted,
      iv,
      authTag,
      timeStamp: Date.now(),
    }

    fs.writeFileSync(tokenFilePath, JSON.stringify(tokenData, null, 2), { mode: 0o600 })
  }

  public async loadToken(): Promise<string | null> {
    try {
      const tokenFilePath = this.getTokenFilePath()

      if (!fs.existsSync(tokenFilePath)) {
        return null
      }

      const tokenData = JSON.parse(fs.readFileSync(tokenFilePath, "utf8"))
      const { encrypted, iv, authTag } = tokenData

      const token = this.decrypt(encrypted, iv, authTag)
      return token
    } catch (err) {
      this.clearToken()
      return null
    }
  }

  public async clearToken(): Promise<void> {
    try {
      const tokenFilePath = this.getTokenFilePath()
      if (fs.existsSync(tokenFilePath)) {
        fs.unlinkSync(tokenFilePath)
      }
    } catch (err) {
      throw new Error(`Failed to clear token: ${err}`)
    }
  }

  private getTokenFilePath(): string {
    const configPath = path.dirname(this.keyFilePath)
    return path.join(configPath, "token.enc")
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
      } catch (err) {
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
      this.rejectCallback?.(err as Error)
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

      if (code !== this.clientSecret) {
        res.writeHead(400)
        res.end("Bad Request")
        return
      }

      if (quit === "true" || quit === "access_denied") {
        this.rejectCallback?.(new Error("User quit the login process"))
        res.writeHead(302, {
          Location: `${this.baseUrl}/${this.failedRedirectUrl}`,
        })
        res.end()
        return
      }

      if (!tempToken || !siteId) {
        res.writeHead(400)
        res.end("Bad Request")
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
      this.rejectCallback?.(err as Error)
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
      throw new Error("Failed to open login page")
    }
  }

  private async getJwtToken(tempToken: string, siteId: string): Promise<string> {
    const actualTempToken = tempToken.split("&")[0]

    const countryCode = this.getCountryCodeBySiteId(siteId)

    const params = {
      tempToken: actualTempToken,
      site: countryCode,
      version: "1.0.0",
      appid: this.config.appId.toString(),
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

    const result = httpClient.parseJson<TokenCheckResponse>(response)
    return result
  }

  private parseJwt(token: string): JwtPayload {
    const parts = token.split(".")
    if (parts.length !== 3) {
      throw new Error(`Invalid jwtToken format`)
    }

    const payload = parts[1]
    const base64Url = payload.replace(/-/g, "+").replace(/_/g, "/")
    const base64 = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), "=")
    const json = Buffer.from(base64, "base64").toString("utf8")

    return JSON.parse(json) as JwtPayload
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
    try {
      const headers: Record<string, string> = {
        refresh: "true",
        jwtToken: jwtToken,
      }

      const regionalizedBaseUrl = this.getRegionalizedBaseUrl()
      const url = `${regionalizedBaseUrl}/${this.config.jwtTokenCheckUrl}`
      const response = await httpClient.get(url, { headers })

      if (response.statusCode !== 200) {
        return null
      }

      const result = httpClient.parseJson<TokenCheckResponse>(response)
      if (!result.status || !result.userInfo) {
        return null
      }

      return {
        accessToken: result.userInfo.accessToken,
        refreshToken: result.userInfo.refreshToken ?? "",
      }
    } catch {
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
      await Auth.set("codegenie", {
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
                  await Auth.set("codegenie", {
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

            headers.set("Chat-Id", crypto.randomUUID().replace(/-/g, ""))

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
