import crypto from "crypto"
import { URL } from "url"
import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { OAUTH_DUMMY_KEY } from "@/auth"
import { Global } from "@opencode-ai/core/global"
import { GlobalBus } from "@/bus/global"
import { Effect } from "effect"

async function log(effect: Effect.Effect<void>) {
  const { AppRuntime } = await import("@/effect/app-runtime")
  return AppRuntime.runPromise(effect)
}
import { devecoAuth } from "./auth"
import { sessionChatIdMap } from "./session"
import { ensureValidToken } from "./token-refresh"
import { ACCESS_TOKEN_EXPIRES_MS, PROVIDER_ID } from "./types"

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
                const newToken = await ensureValidToken()
                if (newToken) {
                  currentAuth.access = newToken
                } else {
                  await log(Effect.logError("DevEco Code token refresh failed, user needs to re-login", { service: "deveco" }))
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
                  return new Response(
                    JSON.stringify({ error: "Token refresh failed. Please re-login to DevEco Code." }),
                    {
                      status: 401,
                      statusText: "Unauthorized",
                      headers: { "Content-Type": "application/json" },
                    },
                  )
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
            const chatId =
              (sessionId && sessionChatIdMap.get(sessionId)) || crypto.randomUUID().replace(/-/g, "")
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
                  const url =
                    requestInput instanceof URL
                      ? new URL(requestInput.toString())
                      : new URL(typeof requestInput === "string" ? requestInput : requestInput.url)
                  url.pathname = url.pathname
                    .replace(/\/$/, "")
                    .replace(/\/chat\/completions$/, "/no-stream/chat/completions")
                  finalInput = url
                }
              } catch {
                await log(Effect.logError("Failed to rewrite URL for non-streaming request", { service: "deveco", requestInput: String(requestInput) }))
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
                  if (result.unsupportedRegion) {
                    return {
                      type: "failed" as const,
                      error: "Sorry, only China site accounts are currently supported",
                    }
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
