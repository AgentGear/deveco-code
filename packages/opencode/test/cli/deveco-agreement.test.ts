import { describe, expect, mock, test, beforeAll, afterAll } from "bun:test"
import http from "http"

let refreshTokenCalls = 0
let saveAuthCalls: Array<{ key: string; info: Record<string, unknown> }> = []

void mock.module("@/plugin/deveco", () => ({
  devecoAuth: {
    refreshToken: async () => {
      refreshTokenCalls++
      return { accessToken: "new-refreshed-token", refreshToken: "new-refresh-token" }
    },
    getSession: async () => ({
      userId: "test-user",
      userName: "test",
      accessToken: "old-expired-token",
      refreshToken: "old-refresh-token",
      jwtToken: "test-jwt",
      countryCode: "CN",
      expires: Date.now() - 1000,
    }),
    isTokenExpired: () => true,
    getUserId: async () => "test-user",
  },
  saveAuthToDisk: async (key: string, info: Record<string, unknown>) => {
    saveAuthCalls.push({ key, info })
  },
  ACCESS_TOKEN_EXPIRES_MS: 30 * 60 * 1000,
}))

const { agreementService, AgreementStatus } = await import("../../src/cli/deveco-agreement")

describe("agreement session timeout retry", () => {
  let server: http.Server
  let serverUrl: string
  let requestLog: Array<{ body: string; accessToken: string }>

  beforeAll(async () => {
    requestLog = []
    refreshTokenCalls = 0
    saveAuthCalls = []

    server = http.createServer((req, res) => {
      let data = ""
      req.on("data", (chunk: Buffer) => { data += chunk.toString() })
      req.on("end", () => {
        requestLog.push({ body: data, accessToken: "" })

        if (requestLog.length === 1) {
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "session timeout" }))
        } else {
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify({
            errorCode: 0,
            signInfo: [
              {
                isAgree: true,
                version: 2,
                agrType: "20000222",
                country: "CN",
                language: "zh_CN",
                newestVersion: 2,
                newestSubVersion: 0,
                needSign: false,
                matchedVersion: 2,
                matchedSubVersion: 0,
                subVersion: 0,
              },
              {
                isAgree: true,
                version: 2,
                agrType: "10000351",
                country: "CN",
                language: "zh_CN",
                newestVersion: 2,
                newestSubVersion: 0,
                needSign: false,
                matchedVersion: 2,
                matchedSubVersion: 0,
                subVersion: 0,
              },
            ],
          }))
        }
      })
    })

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address()
        if (addr && typeof addr === "object") {
          serverUrl = `http://127.0.0.1:${addr.port}/agreementservice/user`
        }
        resolve()
      })
    })
  })

  afterAll(() => {
    server.close()
  })

  test("persists refreshed token to disk after session timeout", async () => {
    agreementService.configure({ tms_url: serverUrl })

    const kvStore = { get: () => false }
    const result = await agreementService.checkAllAgreements("old-expired-token", kvStore)

    expect(requestLog.length).toBe(2)

    expect(refreshTokenCalls).toBe(1)

    expect(saveAuthCalls.length).toBeGreaterThanOrEqual(1)
    const devecoSave = saveAuthCalls.find((c) => c.key === "deveco")
    expect(devecoSave).toBeDefined()
    expect(devecoSave!.info.type).toBe("oauth")
    expect(devecoSave!.info.access).toBe("new-refreshed-token")
    expect(devecoSave!.info.refresh).toBe("new-refresh-token")
    expect(typeof devecoSave!.info.expires).toBe("number")
    expect(devecoSave!.info.expires as number).toBeGreaterThan(Date.now())

    expect(result.overallStatus).toBe(AgreementStatus.COMPLIANT)
    expect(result.canEnter).toBe(true)
  })

  test("returns SESSION_EXPIRED when token refresh fails", async () => {
    requestLog = []
    refreshTokenCalls = 0
    saveAuthCalls = []

    mock.module("@/plugin/deveco", () => ({
      devecoAuth: {
        refreshToken: async () => null,
        getSession: async () => null,
        isTokenExpired: () => true,
        getUserId: async () => null,
      },
      saveAuthToDisk: async (key: string, info: Record<string, unknown>) => {
        saveAuthCalls.push({ key, info })
      },
      ACCESS_TOKEN_EXPIRES_MS: 30 * 60 * 1000,
    }))

    const result = await agreementService.checkAllAgreements("expired-token", { get: () => false })

    expect(saveAuthCalls.length).toBe(0)
    expect(result.canEnter).toBe(false)
    expect(result.overallStatus).toBe(AgreementStatus.SESSION_EXPIRED)
  })
})
