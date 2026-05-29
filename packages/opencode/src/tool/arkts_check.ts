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
import os from "os"
import path from "path"
import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { findDevEcoHome, nodePath } from "./lib/env"
import { getSessionCwd } from "./lib/session-cwd"
import ARKTS_CHECK_SCRIPT_RAW from "./arkts-check.cjs" with { type: "text" }
import DESCRIPTION from "./arkts-check.txt"

const ARKTS_CHECK_SCRIPT = ARKTS_CHECK_SCRIPT_RAW as unknown as string

const Parameters = Schema.Struct({
  files: Schema.Array(Schema.String).annotate({
    description: "List of .ets file paths (relative to the project root or absolute)",
  }),
})

interface ArktsCheckMetadata {
  errorCount?: number
  warnCount?: number
  fileCount?: number
}

interface Diagnostic {
  file: string
  line: number
  column: number
  severity: string
  message: string
  rule: string
}

interface ScriptOutput {
  success?: boolean
  error?: string
  errors?: Diagnostic[]
  summary?: { errorCount?: number; warnCount?: number }
}

let cachedScriptPath: string | undefined

async function ensureScriptOnDisk(): Promise<string> {
  if (cachedScriptPath && fs.existsSync(cachedScriptPath)) return cachedScriptPath

  const cacheDir = path.join(os.tmpdir(), "deveco-arkts-check")
  fs.mkdirSync(cacheDir, { recursive: true })
  const target = path.join(cacheDir, "arkts-check.cjs")

  let needWrite = true
  if (fs.existsSync(target)) {
    try {
      const existing = fs.readFileSync(target, "utf-8")
      if (existing === ARKTS_CHECK_SCRIPT) needWrite = false
    } catch {}
  }
  if (needWrite) fs.writeFileSync(target, ARKTS_CHECK_SCRIPT, "utf-8")
  cachedScriptPath = target
  return target
}

function resolveProjectRoot(ctx: Tool.Context): string {
  const sessionDir = getSessionCwd(ctx.sessionID)
  if (sessionDir) return sessionDir
  return process.cwd()
}

async function run(cmd: string[], cwd: string) {
  const proc = Bun.spawn({
    cmd,
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout ? Bun.readableStreamToText(proc.stdout) : Promise.resolve(""),
    proc.stderr ? Bun.readableStreamToText(proc.stderr) : Promise.resolve(""),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

export const ArktsCheckTool = Tool.define(
  "arkts_check",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (args: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<ArktsCheckMetadata>) =>
        Effect.gen(function* () {
          const projectRoot = resolveProjectRoot(ctx)

          const home = yield* Effect.tryPromise(() => findDevEcoHome())
          if (!home) {
            throw new Error(
              "DevEco Studio path not found. Set DEVECO_HOME to your DevEco installation directory and retry.",
            )
          }
          const node = nodePath(home)
          const nodeExists = yield* Effect.tryPromise(() => Bun.file(node).exists())
          if (!nodeExists) {
            throw new Error(`Node binary not found in DevEco Studio: ${node}`)
          }

          const scriptPath = yield* Effect.tryPromise(() => ensureScriptOnDisk())
          const filesArr = Array.from(args.files)

          const cmd = [node, scriptPath, "--project", projectRoot, "--files", ...filesArr]
          const result = yield* Effect.tryPromise(() => run(cmd, projectRoot))
          const stdout = result.stdout.trim()
          const stderr = result.stderr.trim()

          if (!stdout) {
            const detail = stderr || `arkts-check exited with code ${result.exitCode} but produced no output`
            throw new Error(detail)
          }

          let parsed: ScriptOutput
          try {
            parsed = JSON.parse(stdout) as ScriptOutput
          } catch {
            throw new Error(`Failed to parse arkts-check output: ${stdout.slice(0, 500)}`)
          }

          if (parsed.error && (!parsed.errors || parsed.errors.length === 0)) {
            throw new Error(parsed.error)
          }

          const diagnostics = parsed.errors ?? []
          const errors = diagnostics.filter((d) => d.severity === "error")
          const errorCount = errors.length
          const warnCount = diagnostics.length - errorCount

          if (errors.length === 0) {
            return {
              title: "ArkTS Check Passed",
              output: `No errors found in ${filesArr.length} file(s).`,
              metadata: { errorCount: 0, warnCount, fileCount: filesArr.length } as ArktsCheckMetadata,
            }
          }

          const lines = errors.map((d) => {
            const ruleSuffix = d.rule ? ` (${d.rule})` : ""
            return `${d.file}:${d.line}:${d.column} - ${d.severity}: ${d.message}${ruleSuffix}`
          })
          const header = `ArkTS check found ${errorCount} error(s):`
          return {
            title: "ArkTS Check Failed",
            output: [header, ...lines].join("\n"),
            metadata: { errorCount, warnCount, fileCount: filesArr.length } as ArktsCheckMetadata,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
