import https from "https"
import http from "http"
import querystring from "querystring"
import { resolveAgreementConfig, getPrivacyAcceptedKey, getSignPendingKey, type AgreementConfig } from "@/cli/deveco-legal"
import { devecoAuth, saveAuthToDisk, ACCESS_TOKEN_EXPIRES_MS } from "@/plugin/deveco"
import { Effect } from "effect"

async function log(effect: Effect.Effect<void>) {
  const { AppRuntime } = await import("@/effect/app-runtime")
  return AppRuntime.runPromise(effect)
}
// ============ Data Models ============

export enum AgreementStatus {
  COMPLIANT = "compliant",
  NEED_SIGN = "need_sign",
  NEED_RE_SIGN = "need_re_sign",
  NETWORK_ERROR = "network_error",
  SESSION_EXPIRED = "session_expired",
}

export interface SignInfo {
  isAgree: boolean
  version: number
  agrType: number
  country: string
  language: string
  newestVersion: number
  newestSubVersion: number
  needSign: boolean
  matchedVersion: number
  matchedSubVersion: number
  subVersion: number
  signType: number
  branchId: number
  signTime: number
  cg: string
  contentTag: string
  latestVersion: number
  rpt: number
}

export interface VersionInfo {
  newestVersion: number
  agrType: number
  country: string
  branchId: number
  cg: string
  matchedVersion: number
  matchedSubVersion: number
  newestSubVersion: number
  latestVersion: number
}

export interface AgreementQueryResult {
  status: AgreementStatus
  signInfo: SignInfo | null
  versionInfo: VersionInfo | null
  error?: string
}

export interface AgreementSignResult {
  success: boolean
  isUpload: boolean
  error?: string
  refreshedToken?: boolean
}

export interface AgreementCheckResult {
  privacyStatus: AgreementStatus
  termsStatus: AgreementStatus
  overallStatus: AgreementStatus
  canEnter: boolean
  hasLocalCache: boolean
}

// ============ TMS HTTP Request ============

// Actual error values returned by the TMS API (lowercase with spaces)
const SESSION_TIMEOUT_ERROR = "session timeout"
const INVALID_SESSION_ERROR = "invalid session"

const KEY_ERROR = "error"
const ERROR_CODE = "errorCode"

interface TmsFormBody {
  nsp_svc: string
  access_token: string
  request: string
}

/**
 * Send a POST request to the TMS API using application/x-www-form-urlencoded encoding (NSP protocol format).
 * The `request` field is an embedded JSON string inside the form-encoded body.
 */
async function tmsPost(tmsUrl: string, body: TmsFormBody): Promise<string> {
  const parsedUrl = new URL(tmsUrl)
  const isHttps = parsedUrl.protocol === "https:"
  const httpModule = isHttps ? https : http

  // Encode as application/x-www-form-urlencoded (NSP protocol format)
  const formBody = querystring.stringify({
    nsp_svc: body.nsp_svc,
    access_token: body.access_token,
    request: body.request,
  })

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Content-Length": String(Buffer.byteLength(formBody)),
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept-language": "zh-CN",
  }

  return new Promise((resolve, reject) => {
    const options: http.RequestOptions | https.RequestOptions = {
      method: "POST",
      headers,
      timeout: 10000,
    }

    const req = httpModule.request(tmsUrl, options, (res) => {
      let data = ""
      res.on("data", (chunk: Buffer | string) => {
        data += chunk
      })
      res.on("end", () => {
        resolve(data)
      })
    })

    req.on("error", (err: Error) => {
      reject(err)
    })
    req.on("timeout", () => {
      req.destroy()
      void log(Effect.logError("TMS request timeout", { service: "deveco-agreement", url: tmsUrl }))
      reject(new Error("TMS request timeout"))
    })

    req.write(formBody)
    req.end()
  })
}

// ============ Session Timeout Retry ============

function isSessionTimeoutError(errorValue: unknown): boolean {
  return errorValue === SESSION_TIMEOUT_ERROR || errorValue === INVALID_SESSION_ERROR
}

async function handleSessionTimeoutAndRetry<T>(
  rawResponse: string,
  retryApiCall: (accessToken: string) => Promise<string>,
  accessToken: string,
  parseResponse: (raw: string) => T,
): Promise<{ result: T; refreshedToken: boolean }> {
  let resJson: Record<string, unknown>
  try {
    resJson = JSON.parse(rawResponse) as Record<string, unknown>
  } catch {
    await log(Effect.logWarning("failed to parse TMS response as JSON, falling through to raw parse", { service: "deveco-agreement" }))
    return { result: parseResponse(rawResponse), refreshedToken: false }
  }

  if (isSessionTimeoutError(resJson[KEY_ERROR])) {
    await log(Effect.logInfo("session timeout detected, refreshing token", { service: "deveco-agreement" }))
    const newTokens = await devecoAuth.refreshToken()
    if (!newTokens?.accessToken) {
      await log(Effect.logWarning("token refresh failed, cannot retry", { service: "deveco-agreement" }))
      return { result: parseResponse(rawResponse), refreshedToken: false }
    }

    await saveAuthToDisk("deveco", {
      type: "oauth",
      access: newTokens.accessToken,
      refresh: newTokens.refreshToken,
      expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
    })

    const retryRaw = await retryApiCall(newTokens.accessToken)
    return { result: parseResponse(retryRaw), refreshedToken: true }
  }

  return { result: parseResponse(rawResponse), refreshedToken: false }
}

// ============ AgreementService ============

function parseSignInfo(raw: Record<string, unknown>): SignInfo {
  return {
    isAgree: (raw.isAgree as boolean) ?? false,
    version: (raw.version as number) ?? 0,
    agrType: (raw.agrType as number) ?? 0,
    country: (raw.country as string) ?? "",
    language: (raw.language as string) ?? "",
    newestVersion: (raw.newestVersion as number) ?? 0,
    newestSubVersion: (raw.newestSubVersion as number) ?? 0,
    needSign: (raw.needSign as boolean) ?? false,
    matchedVersion: (raw.matchedVersion as number) ?? 0,
    matchedSubVersion: (raw.matchedSubVersion as number) ?? 0,
    subVersion: (raw.subVersion as number) ?? 0,
    signType: (raw.signType as number) ?? 0,
    branchId: (raw.branchId as number) ?? 0,
    signTime: (raw.signTime as number) ?? 0,
    cg: (raw.cg as string) ?? "",
    contentTag: (raw.contentTag as string) ?? "",
    latestVersion: (raw.latestVersion as number) ?? 0,
    rpt: (raw.rpt as number) ?? 0,
  }
}

function parseVersionInfo(raw: Record<string, unknown>): VersionInfo {
  return {
    newestVersion: (raw.newestVersion as number) ?? 0,
    agrType: (raw.agrType as number) ?? 0,
    country: (raw.country as string) ?? "",
    branchId: (raw.branchId as number) ?? 0,
    cg: (raw.cg as string) ?? "",
    matchedVersion: (raw.matchedVersion as number) ?? 0,
    matchedSubVersion: (raw.matchedSubVersion as number) ?? 0,
    newestSubVersion: (raw.newestSubVersion as number) ?? 0,
    latestVersion: (raw.latestVersion as number) ?? 0,
  }
}

class AgreementService {
  private config = resolveAgreementConfig()

  /** Update agreement config from project-level settings. Called before any API use. */
  configure(overrides?: AgreementConfig) {
    this.config = resolveAgreementConfig(overrides)
  }

  /**
   * 查询所有协议签署状态（一次请求传入 PRIVACY_ID 和 TERMS_ID）
   */
  async queryAgreement(accessToken: string): Promise<AgreementQueryResult> {
    // agrInfo includes both agreement IDs in one request
    const requestJson: string = JSON.stringify({
      obtainVersion: true,
      agrInfo: [
        {
          agrType: this.config.privacy_id,
          country: "CN",
          signType: 0,
          branchId: 0,
        },
        {
          agrType: this.config.terms_id,
          country: "CN",
          signType: 0,
          branchId: 0,
        },
      ],
    })

    const tmsBody: TmsFormBody = {
      nsp_svc: "as.user.query",
      access_token: accessToken,
      request: requestJson,
    }

    try {
      const rawResponse = await tmsPost(this.config.tms_url, tmsBody)

      const { result } = await handleSessionTimeoutAndRetry(
        rawResponse,
        async (newToken: string) => {
          const retryBody: TmsFormBody = {
            nsp_svc: "as.user.query",
            access_token: newToken,
            request: requestJson,
          }
          return tmsPost(this.config.tms_url, retryBody)
        },
        accessToken,
        (raw: string) => this.parseQueryResponse(raw),
      )

      return result
    } catch (err) {
      await log(Effect.logError("query agreement exception", { service: "deveco-agreement", error: err instanceof Error ? err.message : String(err) }))
      return {
        status: AgreementStatus.NETWORK_ERROR,
        signInfo: null,
        versionInfo: null,
        error: err instanceof Error ? err.message : "Network error",
      }
    }
  }

  private parseQueryResponse(raw: string): AgreementQueryResult {
    try {
      const resJson = JSON.parse(raw) as Record<string, unknown>

      if (isSessionTimeoutError(resJson[KEY_ERROR])) {
        void log(Effect.logError("query agreement response: session timeout after refresh failure", { service: "deveco-agreement", error: resJson[KEY_ERROR] }))
        return {
          status: AgreementStatus.SESSION_EXPIRED,
          signInfo: null,
          versionInfo: null,
          error: resJson[KEY_ERROR] as string,
        }
      }

      const errorCode = resJson[ERROR_CODE] as number | undefined
      if (errorCode === 0) {
        const signArr = resJson.signInfo as Array<Record<string, unknown>> | undefined
        if (!signArr || signArr.length === 0) {
          void log(Effect.logWarning("query agreement response: empty signInfo array", { service: "deveco-agreement" }))
          return {
            status: AgreementStatus.NEED_SIGN,
            signInfo: null,
            versionInfo: null,
          }
        }

        // Check each agreement: any needSign=true or isAgree=false → NEED_SIGN/NEED_RE_SIGN
        let allCompliant = true
        let anyNeedReSign = false

        for (const signEntry of signArr) {
          const parsedSign = parseSignInfo(signEntry)
          if (parsedSign.needSign) {
            allCompliant = false
            // If needSign but isAgree=true → version expired → NEED_RE_SIGN
            // If needSign and isAgree=false → never signed → NEED_SIGN
            if (parsedSign.isAgree && !compareAgreementVersion(parsedSign.newestVersion, parsedSign.version)) {
              anyNeedReSign = true
            }
          }
          if (!parsedSign.isAgree) {
            allCompliant = false
          }
          if (parsedSign.isAgree && !compareAgreementVersion(parsedSign.newestVersion, parsedSign.version)) {
            allCompliant = false
            anyNeedReSign = true
          }
        }

        if (allCompliant) {
          return {
            status: AgreementStatus.COMPLIANT,
            signInfo: parseSignInfo(signArr[0]),
            versionInfo: null,
          }
        }

        return {
          status: anyNeedReSign ? AgreementStatus.NEED_RE_SIGN : AgreementStatus.NEED_SIGN,
          signInfo: parseSignInfo(signArr[0]),
          versionInfo: null,
        }
      }

      return {
        status: AgreementStatus.NEED_SIGN,
        signInfo: null,
        versionInfo: null,
        error: `errorCode=${errorCode}`,
      }
    } catch (err) {
      void log(Effect.logError("failed to parse agreement query response", { service: "deveco-agreement", error: err instanceof Error ? err.message : String(err) }))
      return {
        status: AgreementStatus.NEED_SIGN,
        signInfo: null,
        versionInfo: null,
        error: "Failed to parse query response",
      }
    }
  }

  /**
   * 签署两个协议（隐私+用户协议），一次请求同时签署
   */
  async signAgreement(accessToken: string, isRetry: boolean): Promise<AgreementSignResult> {
    const requestJson: string = JSON.stringify({
      signInfo: [
        {
          agrType: this.config.privacy_id,
          country: "CN",
          language: "zh_CN",
          isAgree: true,
        },
        {
          agrType: this.config.terms_id,
          country: "CN",
          language: "zh_CN",
          isAgree: true,
        },
      ],
    })

    const tmsBody: TmsFormBody = {
      nsp_svc: "as.user.sign",
      access_token: accessToken,
      request: requestJson,
    }

    try {
      const rawResponse = await tmsPost(this.config.tms_url, tmsBody)

      const { result, refreshedToken } = await handleSessionTimeoutAndRetry(
        rawResponse,
        async (newToken: string) => {
          const retryBody: TmsFormBody = {
            nsp_svc: "as.user.sign",
            access_token: newToken,
            request: requestJson,
          }
          return tmsPost(this.config.tms_url, retryBody)
        },
        accessToken,
        (raw: string) => this.parseSignResponse(raw),
      )

      return { ...result, refreshedToken }
    } catch (err) {
      await log(Effect.logError("sign agreement exception", { service: "deveco-agreement", error: err instanceof Error ? err.message : String(err) }))
      return {
        success: false,
        isUpload: false,
        error: err instanceof Error ? err.message : "Network error",
      }
    }
  }

  private parseSignResponse(raw: string): AgreementSignResult {
    try {
      const resJson = JSON.parse(raw) as Record<string, unknown>

      if (isSessionTimeoutError(resJson[KEY_ERROR])) {
        void log(Effect.logError("sign agreement response: session timeout", { service: "deveco-agreement", error: resJson[KEY_ERROR] }))
        return {
          success: false,
          isUpload: false,
          error: resJson[KEY_ERROR] as string,
        }
      }

      const errorCode = resJson[ERROR_CODE] as number | undefined
      if (errorCode === 0) {
        return { success: true, isUpload: true }
      }

      void log(Effect.logError("sign agreement response: non-zero errorCode", { service: "deveco-agreement", errorCode }))
      return {
        success: false,
        isUpload: false,
        error: `errorCode=${errorCode}`,
      }
    } catch (err) {
      void log(Effect.logError("failed to parse agreement sign response", { service: "deveco-agreement", error: err instanceof Error ? err.message : String(err) }))
      return {
        success: false,
        isUpload: false,
        error: "Failed to parse sign response",
      }
    }
  }

  /**
   * 综合检查两个协议的签署状态（一次请求查询所有协议）
   */
  async checkAllAgreements(
    accessToken: string,
    userId: string,
    kvStore: { get: (key: string, defaultValue: unknown) => unknown },
  ): Promise<AgreementCheckResult> {
    const queryResult = await this.queryAgreement(accessToken)

    const overallStatus = queryResult.status
    const hasLocalCache = kvStore.get(getPrivacyAcceptedKey(userId), false) === true

    // For privacy/terms individual status, both share the same overall query result
    // since we query both in one request
    const privacyStatus = overallStatus
    const termsStatus = overallStatus

    // COMPLIANT → can enter
    if (overallStatus === AgreementStatus.COMPLIANT) {
      return {
        privacyStatus,
        termsStatus,
        overallStatus,
        canEnter: true,
        hasLocalCache,
      }
    }

    // NETWORK_ERROR → allow entry if local cache exists (offline degradation)
    // Without local cache, show privacy step so user can see the network error
    if (overallStatus === AgreementStatus.NETWORK_ERROR) {
      if (hasLocalCache) {
        await log(Effect.logInfo("agreement query network error, but local cache exists — allowing entry", { service: "deveco-agreement" }))
        return {
          privacyStatus,
          termsStatus,
          overallStatus,
          canEnter: true,
          hasLocalCache,
        }
      }
      return {
        privacyStatus,
        termsStatus,
        overallStatus,
        canEnter: false,
        hasLocalCache,
      }
    }

    // SESSION_EXPIRED → refresh token failed, user needs to re-login
    if (overallStatus === AgreementStatus.SESSION_EXPIRED) {
      return {
        privacyStatus,
        termsStatus,
        overallStatus,
        canEnter: false,
        hasLocalCache,
      }
    }

    // NEED_SIGN / NEED_RE_SIGN → cannot enter
    return {
      privacyStatus,
      termsStatus,
      overallStatus,
      canEnter: false,
      hasLocalCache,
    }
  }

  /**
   * Retry any pending offline agreement sign. Called on app startup as a
   * fire-and-forget operation. If a pending sign exists and the API is
   * reachable, syncs the sign and clears the pending flag.
   */
  async retryPendingSign(
    accessToken: string,
    userId: string,
    kvStore: { get: (key: string, defaultValue: unknown) => unknown; set: (key: string, value: unknown) => void },
  ): Promise<void> {
    const hasPending = kvStore.get(getSignPendingKey(userId), false) === true
    if (!hasPending) {
      return
    }

    await log(Effect.logInfo("found pending offline agreement sign, retrying...", { service: "deveco-agreement", userId }))
    const signResult = await this.signAgreement(accessToken, false)

    if (signResult.isUpload) {
      kvStore.set(getSignPendingKey(userId), false)
      await log(Effect.logInfo("pending offline agreement sign synced successfully", { service: "deveco-agreement", userId }))
    } else {
      await log(Effect.logWarning("pending offline agreement sign retry failed", { service: "deveco-agreement", error: signResult.error ?? "unknown error", userId }))
    }
  }
}

// ============ Version Comparison ============

function compareAgreementVersion(newestVersion: number, signedVersion: number): boolean {
  return signedVersion >= newestVersion
}

// ============ Export ============

export const agreementService = new AgreementService()
export { compareAgreementVersion }