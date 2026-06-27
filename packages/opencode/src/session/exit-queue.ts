import { Context, Effect, Layer } from "effect"
import { Global } from "@opencode-ai/core/global"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { LocalCrypto } from "@/security/local-crypto"
import { sessionChatIdMap } from "@/plugin/deveco"
import fs from "fs"
import path from "path"

const authFilePath = path.join(Global.Path.data, "auth.json")

function loadAccessTokenFromDisk(): string {
  try {
    if (!fs.existsSync(authFilePath)) return ""
    const raw = JSON.parse(fs.readFileSync(authFilePath, "utf-8")) as Record<string, unknown>
    const data = LocalCrypto.decryptAuthData(raw) as Record<string, unknown>
    const deveco = data.deveco as Record<string, unknown> | undefined
    if (deveco?.type === "oauth" && typeof deveco.access === "string") {
      return deveco.access
    }
  } catch {

  }
  return ""
}

export interface Interface {
  readonly exit: (sessionID: string, modelId: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ExitQueue") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const exit: Interface["exit"] = Effect.fn("ExitQueue.exit")(function* (
      sessionID: string,
      modelId: string,
    ) {
      const chatId = sessionChatIdMap.get(sessionID)
      const url = `https://cn.devecostudio.huawei.com/sse/codeGenie/exitSessionQueue?modelId=${encodeURIComponent(modelId)}`

      const accessToken = loadAccessTokenFromDisk()

      yield* Effect.tryPromise({
        try: () =>
          fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Session-Id": sessionID,
              ...(chatId ? { "Chat-Id": chatId } : {}),
              ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
            },
          }),
        catch: (e) => new Error(e instanceof Error ? e.message : String(e)),
      }).pipe(
        Effect.timeout("5 seconds"),
        Effect.catch((error) =>
          Effect.logError("failed to exit queue", { service: "session.exit-queue", error: String(error) }),
        ),
        Effect.ignore,
      )
    })

    return Service.of({ exit })
  }),
)

export const defaultLayer = layer

export const node = LayerNode.make(layer, [])

export * as ExitQueue from "./exit-queue"
