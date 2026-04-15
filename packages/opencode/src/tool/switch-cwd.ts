/*
 * Copyright (c) 2026 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import z from "zod"
import * as fs from "fs/promises"
import path from "path"
import { Tool } from "./tool"
import { Instance } from "../project/instance"
import { assertExternalDirectory } from "./external-directory"
import { ensureInitialized } from "./lib/harmony_napi"
import { setSessionCwd } from "./lib/session-cwd"
import DESCRIPTION from "./switch-cwd.txt"

function resolveTarget(projectPath: string) {
  const trimmed = projectPath.trim()
  if (!trimmed) {
    throw new Error("project_path must not be empty")
  }
  if (path.isAbsolute(trimmed)) {
    return path.normalize(trimmed)
  }
  return path.resolve(Instance.directory, trimmed)
}

/** Stage app root, or project root with hvigor OHPM metadata (not a submodule folder). */
async function isHarmonyApplicationRoot(dir: string) {
  const isFile = async (p: string) => (await fs.stat(p).catch(() => undefined))?.isFile() === true
  if (await isFile(path.join(dir, "AppScope", "app.json5"))) return true
  if (!(await isFile(path.join(dir, "build-profile.json5")))) return false
  if (await isFile(path.join(dir, "oh-package.json5"))) return true
  if (await isFile(path.join(dir, "oh-package.json"))) return true
  return false
}

export const SwitchCwdTool = Tool.define("switch_cwd", async () => {
  return {
    description: DESCRIPTION,
    parameters: z.object({
      project_path: z
        .string()
        .describe("Target project directory path. Relative path is resolved from the current workspace directory."),
    }),
    async execute(args, ctx) {
      const target = resolveTarget(args.project_path)
      const stat = await fs.stat(target).catch(() => undefined)
      if (!stat?.isDirectory()) {
        throw new Error(`Not a directory or not found: ${target}`)
      }

      await assertExternalDirectory(ctx, target, { kind: "directory" })
      setSessionCwd(ctx.sessionID, target)

      if (!(await isHarmonyApplicationRoot(target))) {
        return {
          title: "Switch project context",
          output: `Session directory updated to ${target}.\n
          It's not a HarmonyOS application project root.
          It's directory without AppScope/app.json5, or build-profile.json5 with oh-package.json5 (or oh-package.json).\n
          You can creaete a new HarmonyOS project.` ,
          metadata: {},
        }
      }

      return {
        title: "Switch project context",
        output: `Session directory updated to ${target}.`,
        metadata: {},
      }
    },
  }
})
