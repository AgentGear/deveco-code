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

import { Effect, Schema } from "effect"
import path from "path"
import * as Tool from "./tool"
import { realpathSync } from "fs"
import { assertExternalDirectoryEffect } from "./external-directory"
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
  return path.resolve(process.cwd(), trimmed)
}

/** Stage app root, or project root with hvigor OHPM metadata (not a submodule folder). */
async function isHarmonyApplicationRoot(dir: string) {
  const { stat } = await import("fs/promises")
  const isFile = async (p: string) => (await stat(p).catch(() => undefined))?.isFile() === true
  if (await isFile(path.join(dir, "AppScope", "app.json5"))) return true
  if (!(await isFile(path.join(dir, "build-profile.json5")))) return false
  if (await isFile(path.join(dir, "oh-package.json5"))) return true
  if (await isFile(path.join(dir, "oh-package.json"))) return true
  return false
}

const Parameters = Schema.Struct({
  project_path: Schema.String.annotate({
    description: "Target project directory path. Relative path is resolved from the current workspace directory.",
  }),
})

export const SwitchCwdTool = Tool.define("switch_cwd", Effect.gen(function* () {
  return {
    description: DESCRIPTION,
    parameters: Parameters,
    execute: (args: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
      Effect.gen(function* () {
        const target = realpathSync(resolveTarget(args.project_path))
        const stat = yield* Effect.tryPromise(() => import("fs/promises").then((fs) => fs.stat(target)))
        if (!stat?.isDirectory()) {
          throw new Error(`Not a directory or not found: ${target}`)
        }

        yield* assertExternalDirectoryEffect(ctx, target, { kind: "directory" })
        setSessionCwd(ctx.sessionID, target)

        const isHarmony = yield* Effect.tryPromise(() => isHarmonyApplicationRoot(target))
        if (!isHarmony) {
          return {
            title: "Switch project context",
            output: `Session directory updated to ${target}.\n
            It's not a HarmonyOS application project root.
            It's directory without AppScope/app.json5, or build-profile.json5 with oh-package.json5 (or oh-package.json).\n
            You can create a new HarmonyOS project.`,
            metadata: {},
          }
        }

        return {
          title: "Switch project context",
          output: `Session directory updated to ${target}.`,
          metadata: {},
        }
      }).pipe(Effect.orDie),
  }
}))
