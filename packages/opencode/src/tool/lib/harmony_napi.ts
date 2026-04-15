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

let gate: Promise<void> = Promise.resolve()
let bound = ""

async function runInit(worktree: string) {
  const devecoHome = await findDevEcoHome()
  if (!devecoHome) {
    throw new Error("DevEco Studio not found. Please set DEVECO_HOME to your DevEco installation directory.")
  }
  const logDir = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share', 'codegenie'), 'log', 'deveco-mcp');
  fs.mkdirSync(logDir, { recursive: true });
  await bridge.init(
    logDir, worktree, devecoHome,
    process.env.UI_VERIFY_BASE_URL ?? null,
    process.env.UI_VERIFY_API_KEY ?? null,
    process.env.UI_VERIFY_MODEL_NAME ?? null,
  )
}

/** Re-runs native bridge init when worktree changes (e.g. after switch_cwd). */
export async function ensureInitialized(worktree: string): Promise<void> {
  gate = gate.then(async () => {
    if (bound === worktree) return
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


