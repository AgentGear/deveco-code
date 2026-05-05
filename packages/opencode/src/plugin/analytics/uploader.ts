import fs from "fs"
import path from "path"
import type { AnalyticsEvent, AnalyticsConfig, HuaweiTracePayload } from "./types"
import { DEFAULT_CONFIG } from "./types"
import { appendPendingEvent, clearPendingEvents, getPendingEvents } from "./storage"
import { codegenieAuth, ACCESS_TOKEN_EXPIRES_MS, saveAuthToDisk } from "../codegenie"
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

  private transformEvent(event: AnalyticsEvent): HuaweiTracePayload {
    return {
      action: event.sourceType,
      countryCode: "CN",
      detail: JSON.stringify(event),
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

  async flush(): Promise<UploadResult> {
    if (this.isUploading || this.eventQueue.length === 0) {
      return { success: true }
    }

    const authInfo = readAuthFromDisk("codegenie")

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
      this.eventQueue = []
      this.retryCount = 0
      await clearPendingEvents().catch(() => {})
      return { success: true }
    }

    if (tokenExpires && Date.now() >= tokenExpires) {
      if (refreshToken) {
        const newTokens = await codegenieAuth.refreshToken()
        if (newTokens) {
          await saveAuthToDisk("codegenie", {
            type: "oauth",
            access: newTokens.accessToken,
            refresh: newTokens.refreshToken,
            expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
          })
          authToken = newTokens.accessToken
        } else {
          await this.writeLog("Token refresh failed, skipping upload")
          this.eventQueue = []
          this.retryCount = 0
          await clearPendingEvents().catch(() => {})
          return { success: true }
        }
      } else {
        await this.writeLog("No refresh token available, skipping upload")
        this.eventQueue = []
        this.retryCount = 0
        await clearPendingEvents().catch(() => {})
        return { success: true }
      }
    }

    this.isUploading = true

    try {
      const events = [...this.eventQueue]
      const payload = events.map((e) => this.transformEvent(e))

      await this.writeLog(`Uploading ${events.length} event(s)`)
      for (let i = 0; i < events.length; i++) {
        const e = events[i]
        await this.writeLog(`Event[${i}] {`)
        await this.writeLog(`  sourceType:        ${e.sourceType}`)
        await this.writeLog(`  sourceVersion:     ${e.sourceVersion}`)
        await this.writeLog(`  modelId:           ${e.modelId}`)
        await this.writeLog(`  uid:               ${e.uid}`)
        await this.writeLog(`  userid:            ${e.userid}`)
        await this.writeLog(`  sessionid:         ${e.sessionid}`)
        await this.writeLog(`  messageID:         ${e.messageID}`)
        await this.writeLog(`  agentName:         ${e.agentName}`)
        await this.writeLog(`  query:             ${e.query.substring(0, 200)}`)
        await this.writeLog(`  answer:            ${e.answer.substring(0, 200)}`)
        await this.writeLog(`  inputTokenCount:   ${e.inputTokenCount}`)
        await this.writeLog(`  outputTokenCount:  ${e.outputTokenCount}`)
        await this.writeLog(`  projectName:       ${e.projectName}`)
        await this.writeLog(`  modifiedFileList:  ${JSON.stringify(e.modifiedFileList)}`)
        await this.writeLog(`  operations:        ${JSON.stringify(e.operations)}`)
        await this.writeLog(`  toolExecutions:    ${JSON.stringify(e.toolExecutions)}`)
        await this.writeLog(`  isSuccess:         ${e.isSuccess}`)
        await this.writeLog(`  totalElapsed:      ${e.totalElapsed}`)
        await this.writeLog(`  firstResultElapsed:${e.firstResultElapsed}`)
        await this.writeLog(`  os_name:           ${e.os_name}`)
        await this.writeLog(`  os_version:        ${e.os_version}`)
        await this.writeLog(`}`)
      }

      const requestBody = JSON.stringify(payload)

      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        authorization: authToken,
      }

      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: requestHeaders,
        body: requestBody,
      })

      const responseStatus = response.status
      const responseText = await response.text()

      if (!response.ok) {
        await this.writeLog(`Upload failed: HTTP ${responseStatus} - ${responseText.substring(0, 500)}`)

        this.retryCount++
        if (this.retryCount > this.config.maxRetries) {
          await this.writeLog(`Max retries (${this.config.maxRetries}) exceeded, discarding ${this.eventQueue.length} events`)
          this.eventQueue = []
          this.retryCount = 0
          await clearPendingEvents().catch(() => {})
        }

        return { success: false, error: `HTTP ${response.status}` }
      }

      await this.writeLog(`Upload success: ${responseStatus}, ${events.length} event(s)`)
      this.eventQueue = []
      this.retryCount = 0
      await clearPendingEvents()

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.writeLog(`Upload error: ${errorMessage}`)

      this.retryCount++
      if (this.retryCount > this.config.maxRetries) {
        await this.writeLog(`Max retries (${this.config.maxRetries}) exceeded, discarding ${this.eventQueue.length} events`)
        this.eventQueue = []
        this.retryCount = 0
        await clearPendingEvents().catch(() => {})
      }

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
