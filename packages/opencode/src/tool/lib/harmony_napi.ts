/*
 * Copyright (c) 2026 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from "fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "path"
import { findDevEcoHome } from "./env"
import * as Log from "@opencode-ai/core/util/log"
import { DEVECO_PROVIDER_CONFIG } from "@/plugin/codegenie-models"
import { codegenieAuth, ACCESS_TOKEN_EXPIRES_MS } from "@/plugin/codegenie"

function addon() {
  const execDir = path.dirname(process.execPath)
  // 1. vendor directory (npm / production mode)
  const vendorMarker = path.join(execDir, "..", "vendor", "mcp-bridge-native", "package.json")
  if (fs.existsSync(vendorMarker)) {
    const r = createRequire(vendorMarker)
    return r("./napi_bridge.node") as typeof import("@deveco-codegenie/mcp-bridge")
  }
  // 2. next to binary (legacy standalone mode)
  const legacyMarker = path.join(execDir, "mcp-bridge-native", "package.json")
  if (fs.existsSync(legacyMarker)) {
    const r = createRequire(legacyMarker)
    return r("./napi_bridge.node") as typeof import("@deveco-codegenie/mcp-bridge")
  }
  // 3. node_modules (dev mode)
  return createRequire(import.meta.url)("@deveco-codegenie/mcp-bridge")
}

const bridge = addon()
const log = Log.create({ service: "harmony-napi" })

let gate: Promise<void> = Promise.resolve()
let bound = ""

export async function resolveUIVerifyParams() {
  try {
    const { Effect } = await import("effect")
    const { AppRuntime } = await import("@/effect/app-runtime")
    const { Config } = await import("@/config/config")
    const { Provider } = await import("@/provider/provider")
    const cfg = await AppRuntime.runPromise(Effect.gen(function* () {
      const config = yield* Config.Service
      return yield* config.get()
    }))
    const modelStr = cfg.agent?.["ui_verification"]?.model
    if (modelStr) {
      const { providerID, modelID } = Provider.parseModel(modelStr)
      const [provider, model] = await Promise.all([
        AppRuntime.runPromise(Effect.gen(function* () { const svc = yield* Provider.Service; return yield* svc.getProvider(providerID) })).catch(() => null),
        AppRuntime.runPromise(Effect.gen(function* () { const svc = yield* Provider.Service; return yield* svc.getModel(providerID, modelID) })).catch(() => null),
      ])
      if (provider && model) {
        const baseURL = (provider.options?.baseURL as string | undefined) ?? model.api.url ?? null
        const apiKey = provider.key ?? (provider.options?.apiKey as string | undefined) ?? null
        const modelName = model.api.id ?? null
        return { baseURL, apiKey, modelName }
      }
    }
  } catch {}

  // fallback 1: 环境变量
  if (process.env.UI_VERIFY_BASE_URL && process.env.UI_VERIFY_API_KEY && process.env.UI_VERIFY_MODEL_NAME) {
    return {
      baseURL: process.env.UI_VERIFY_BASE_URL ?? null,
      apiKey: process.env.UI_VERIFY_API_KEY ?? null,
      modelName: process.env.UI_VERIFY_MODEL_NAME ?? null,
    }
  }

  // fallback 2: codegenie 登录态内置模型
  try {
    const { Effect } = await import("effect")
    const { AppRuntime } = await import("@/effect/app-runtime")
    const { Auth } = await import("@/auth")
    const getAuth = () => AppRuntime.runPromise(Effect.gen(function* () { const svc = yield* Auth.Service; return yield* svc.get("codegenie") })).catch(() => undefined)
    let auth = await getAuth()
    if (auth instanceof Auth.Oauth && auth.access) {
      if (!auth.access || auth.expires < Date.now()) {
        const tokens = await codegenieAuth.refreshToken()
        if (tokens) {
          await AppRuntime.runPromise(Effect.gen(function* () {
            const svc = yield* Auth.Service
            yield* svc.set("codegenie", new Auth.Oauth({
              type: "oauth",
              access: tokens.accessToken,
              refresh: tokens.refreshToken,
              expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
            }))
          }))
          auth = await getAuth()
        }
      }
      if (auth instanceof Auth.Oauth && auth.access && auth.expires > Date.now()) {
        return {
          baseURL: DEVECO_PROVIDER_CONFIG.api + "/no-stream",
          apiKey: auth.access,
          modelName: "Qwen2.5-VL-72B",
        }
      }
    }
  } catch {}

  return {
    baseURL: null,
    apiKey: null,
    modelName: null,
  }
}

async function runInit(worktree: string) {
  const devecoHome = await findDevEcoHome()
  if (!devecoHome) {
    throw new Error("DevEco Studio not found. Please set DEVECO_HOME to your DevEco installation directory.")
  }
  const logDir = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share', 'codegenie'), 'log', 'deveco-mcp')
  fs.mkdirSync(logDir, { recursive: true })
  const { baseURL, apiKey, modelName } = await resolveUIVerifyParams()
  log.info("ui_verification model", { baseURL, modelName })
  await bridge.init(logDir, worktree, devecoHome, baseURL, apiKey, modelName)
}

/** Re-runs native bridge init when worktree changes or codegenie token expires. */
export async function ensureInitialized(worktree: string): Promise<void> {
  gate = gate.then(async () => {
    if (bound === worktree) {
      const { Effect } = await import("effect")
      const { AppRuntime } = await import("@/effect/app-runtime")
      const { Auth } = await import("@/auth")
      const auth = await AppRuntime.runPromise(Effect.gen(function* () { const svc = yield* Auth.Service; return yield* svc.get("codegenie") })).catch(() => undefined)
      if (!(auth instanceof Auth.Oauth) || auth.expires > Date.now()) return
    }
    bound = worktree
    await runInit(worktree)
  })
  await gate
}

export async function callHarmonyNapiTool(params: {
  worktree: string
  toolName: string
  args: Record<string, unknown>
}): Promise<unknown> {
  await ensureInitialized(params.worktree)
  const resultJson = await bridge.callTool(params.toolName, JSON.stringify(params.args))
  return JSON.parse(resultJson as string)
}

export async function listTools(worktree: string): Promise<unknown> {
  await ensureInitialized(worktree)
  return JSON.parse(bridge.listTools())
}

export async function callTool(
  worktree: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return callHarmonyNapiTool({ worktree, toolName, args })
}

export async function napiBridgeStop(): Promise<void> {
  try {
    await bridge?.stop?.();
  } catch (error) {

  }
}