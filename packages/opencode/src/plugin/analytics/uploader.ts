import fs from "fs"
import path from "path"
import type { AnalyticsEvent, AnalyticsConfig, HuaweiTracePayload } from "./types"
import { DEFAULT_CONFIG } from "./types"
import { appendPendingEvent, clearPendingEvents, getPendingEvents } from "./storage"
import { devecoAuth, ACCESS_TOKEN_EXPIRES_MS, saveAuthToDisk } from "../deveco"
import { Global } from "@opencode-ai/core/global"
import { LocalCrypto } from "@/security/local-crypto"

const ANALYTICS_DIR = path.join(Global.Path.data, "analytics", "log")
const LOG_FILE = path.join(ANALYTICS_DIR, "analytics.log")

interface UploadResult {
  success: boolean
  error?: string
}

interface AuthInfo {
  type: string
  access?: string
  refresh?: string
  expires?: number
  key?: string
}

function readAuthFromDisk(providerID: string): AuthInfo | undefined {
  try {
    const authFilePath = path.join(Global.Path.data, "auth.json")
    if (!fs.existsSync(authFilePath)) return undefined
    const encrypted = JSON.parse(fs.readFileSync(authFilePath, "utf8")) as Record<string, unknown>
    const data = LocalCrypto.decryptAuthData(encrypted)
    return data[providerID] as AuthInfo | undefined
  } catch {
    return undefined
  }
}

export class AnalyticsUploader {
  private config: AnalyticsConfig
  private eventQueue: AnalyticsEvent[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private isUploading = false
  private retryCount = 0

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async restorePending(): Promise<void> {
    try {
      const pending = await getPendingEvents()
      if (pending.length > 0) {
        this.eventQueue = pending as AnalyticsEvent[]
        await this.writeLog(`Restored ${pending.length} pending events from disk`)
      }
    } catch (err) {
      await this.writeLog(`Failed to restore pending events: ${err}`)
    }
  }

  private async hashSha256(value: string): Promise<string> {
    const data = new TextEncoder().encode(value)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  }

  private async transformEvent(event: AnalyticsEvent): Promise<HuaweiTracePayload> {
    const hashedUserid = await this.hashSha256(event.userid)
    const detail = { ...event, userid: hashedUserid }
    return {
      action: "DevEco-Code",
      countryCode: "CN",
      detail: JSON.stringify(detail),
      osArch: event.os_name,
      sid: 10200,
      timestamp: Date.now(),
      uid: event.uid,
      version: event.sourceVersion,
    }
  }

  private async writeLog(message: string): Promise<void> {
    try {
      fs.mkdirSync(ANALYTICS_DIR, { recursive: true })
      const timestamp = new Date().toISOString()
      const line = `[${timestamp}] ${message}\n`
      fs.appendFileSync(LOG_FILE, line, "utf-8")
    } catch {
      // ignore log errors
    }
  }

  async upload(event: AnalyticsEvent): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    try {
      await appendPendingEvent(event)
    } catch (err) {
      await this.writeLog(`Failed to persist event to disk: ${err}`)
    }

    this.eventQueue.push(event)

    if (this.eventQueue.length > this.config.maxQueueSize) {
      const dropped = this.eventQueue.length - this.config.maxQueueSize
      this.eventQueue = this.eventQueue.slice(-this.config.maxQueueSize)
      await this.writeLog(`Queue full, dropped ${dropped} old events`)
    }

    if (this.eventQueue.length >= this.config.batchSize) {
      await this.flush()
    }

    return true
  }

  private async resolveAuth(): Promise<string | null> {
    const authInfo = readAuthFromDisk("deveco")

    let authToken = ""
    let tokenExpires = 0
    let refreshToken = ""

    if (authInfo?.type === "oauth") {
      authToken = authInfo.access || ""
      tokenExpires = authInfo.expires || 0
      refreshToken = authInfo.refresh || ""
    } else if (authInfo?.type === "api") {
      authToken = authInfo.key || ""
    }

    if (!authToken) {
      await this.writeLog("No auth token, skipping upload")
      return null
    }

    if (tokenExpires && Date.now() >= tokenExpires) {
      if (refreshToken) {
        const newTokens = await devecoAuth.refreshToken()
        if (newTokens) {
          await saveAuthToDisk("deveco", {
            type: "oauth",
            access: newTokens.accessToken,
            refresh: newTokens.refreshToken,
            expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
          })
          return newTokens.accessToken
        }
        await this.writeLog("Token refresh failed, skipping upload")
        return null
      }
      await this.writeLog("No refresh token available, skipping upload")
      return null
    }

    return authToken
  }

  private async handleRetryExceeded(): Promise<void> {
    await this.writeLog(`Max retries (${this.config.maxRetries}) exceeded, discarding ${this.eventQueue.length} events`)
    this.eventQueue = []
    this.retryCount = 0
    await clearPendingEvents().catch(() => {})
  }

  private async sendEvents(authToken: string): Promise<UploadResult> {
    const events = [...this.eventQueue]
    const payload = await Promise.all(events.map((e) => this.transformEvent(e)))

    await this.writeLog(`Uploading ${events.length} event(s)`)

    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: authToken },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      await this.writeLog(`Upload failed: HTTP ${response.status}, ${events.length} event(s)`)
      this.retryCount++
      if (this.retryCount > this.config.maxRetries) await this.handleRetryExceeded()
      return { success: false, error: `HTTP ${response.status}` }
    }

    await this.writeLog(`Upload success: ${response.status}, ${events.length} event(s)`)
    this.eventQueue = []
    this.retryCount = 0
    await clearPendingEvents()
    return { success: true }
  }

  async flush(): Promise<UploadResult> {
    if (this.isUploading || this.eventQueue.length === 0) return { success: true }

    const authToken = await this.resolveAuth()
    if (!authToken) {
      this.eventQueue = []
      this.retryCount = 0
      await clearPendingEvents().catch(() => {})
      return { success: true }
    }

    this.isUploading = true

    try {
      return await this.sendEvents(authToken)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.writeLog(`Upload error: ${errorMessage}`)
      this.retryCount++
      if (this.retryCount > this.config.maxRetries) await this.handleRetryExceeded()
      return { success: false, error: errorMessage }
    } finally {
      this.isUploading = false
    }
  }

  getQueueLength(): number {
    return this.eventQueue.length
  }

  clearQueue(): void {
    this.eventQueue = []
    this.retryCount = 0
  }

  startPeriodicFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => this.writeLog(`Periodic flush error: ${err}`))
    }, this.config.flushInterval)
  }

  stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  async shutdown(): Promise<void> {
    this.stopPeriodicFlush()
    if (this.eventQueue.length > 0) {
      await this.writeLog("Shutting down, flushing remaining events...")
      await this.flush()
    }
  }
}

export const globalUploader = new AnalyticsUploader()

export async function uploadAnalyticsEvent(event: AnalyticsEvent): Promise<boolean> {
  return globalUploader.upload(event)
}

export async function flushAnalyticsEvents(): Promise<UploadResult> {
  return globalUploader.flush()
}

export function clearAnalyticsQueue(): void {
  globalUploader.clearQueue()
}
