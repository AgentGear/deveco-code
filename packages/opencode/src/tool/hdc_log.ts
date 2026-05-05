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

import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { findDevEcoHome, hdcPath } from "./lib/env"
import DESCRIPTION from "./hdc-log.txt"

function pick(input: string, prefix: string, lines: number) {
  const list = input
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
  const filtered = prefix ? list.filter((item) => item.includes(prefix)) : list
  return filtered.slice(Math.max(0, filtered.length - lines))
}

async function run(cmd: string[]) {
  const proc = Bun.spawn({
    cmd,
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

function target(device: string | undefined) {
  return device ? ["-t", device] : []
}

interface HdcLogMetadata {
  deviceCount?: number
  lineCount?: number
}

const Parameters = Schema.Struct({
  action: Schema.Literals(["collect", "clear", "list_devices"])
    .annotate({ description: "Action to perform" }),
  device_id: Schema.optional(Schema.String)
    .annotate({ description: "Optional hdc target id" }),
  log_prefix: Schema.String
    .pipe(Schema.optional, Schema.withDecodingDefault(Effect.succeed("[VCODER_DEBUG]")))
    .annotate({ description: "Log prefix to filter" }),
  lines: Schema.Int
    .check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(5000))
    .pipe(Schema.optional, Schema.withDecodingDefault(Effect.succeed(2000)))
    .annotate({ description: "Number of log lines to collect" }),
})

export const HdcLogTool = Tool.define("hdc_log", Effect.gen(function* () {
  return {
    description: DESCRIPTION,
    parameters: Parameters,
    execute: (args: Schema.Schema.Type<typeof Parameters>, _ctx: Tool.Context<HdcLogMetadata>) =>
      Effect.gen(function* () {
        const home = yield* Effect.tryPromise(() => findDevEcoHome())
        if (!home) {
          throw new Error("DevEco Studio path not found. Set DEVECO_HOME and retry.")
        }
        const hdc = hdcPath(home)
        const hdcExists = yield* Effect.tryPromise(() => Bun.file(hdc).exists())
        if (!hdcExists) {
          throw new Error(`hdc not found: ${hdc}`)
        }

        if (args.action === "list_devices") {
          const out = yield* Effect.tryPromise(() => run([hdc, "list", "targets"]))
          if (out.exitCode !== 0) {
            throw new Error(`hdc list targets failed (code=${out.exitCode}): ${out.stderr || out.stdout}`)
          }
          const devices = out.stdout
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter((item) => item && !item.includes("[Empty]"))
          if (!devices.length) {
            return {
              title: "No Devices",
              output: "No connected devices detected.",
              metadata: { deviceCount: 0, lineCount: undefined } as HdcLogMetadata,
            }
          }
          return {
            title: "Connected Devices",
            output: ["Connected devices:", ...devices.map((item, i) => `${i + 1}. ${item}`)].join("\n"),
            metadata: { deviceCount: devices.length, lineCount: undefined } as HdcLogMetadata,
          }
        }

        if (args.action === "clear") {
          const out = yield* Effect.tryPromise(() => run([hdc, ...target(args.device_id), "shell", "hilog", "-r"]))
          if (out.exitCode !== 0) {
            throw new Error(`hdc hilog -r failed (code=${out.exitCode}): ${out.stderr || out.stdout}`)
          }
          return {
            title: "Log Buffer Cleared",
            output: ["Device log buffer cleared.", `device: ${args.device_id || "default"}`].join("\n"),
            metadata: { deviceCount: undefined, lineCount: undefined } as HdcLogMetadata,
          }
        }

        const out = yield* Effect.tryPromise(() => run([hdc, ...target(args.device_id), "shell", "hilog", "-x"]))
        if (out.exitCode !== 0) {
          throw new Error(`hdc hilog -x failed (code=${out.exitCode}): ${out.stderr || out.stdout}`)
        }
        const logs = pick(out.stdout, args.log_prefix ?? "", args.lines ?? 2000)
        if (!logs.length) {
          return {
            title: "No Matching Logs",
            output: [
              "No matching logs found.",
              `device: ${args.device_id || "default"}`,
              `prefix: ${args.log_prefix}`,
            ].join("\n"),
            metadata: { deviceCount: undefined, lineCount: 0 } as HdcLogMetadata,
          }
        }
        return {
          title: "Log Collection Successful",
          output: [
            "Log collection successful.",
            `device: ${args.device_id || "default"}`,
            `prefix: ${args.log_prefix}`,
            `count: ${logs.length}`,
            "",
            "--- Log Content ---",
            ...logs,
          ].join("\n"),
          metadata: { deviceCount: undefined, lineCount: logs.length } as HdcLogMetadata,
        }
      }).pipe(Effect.orDie),
  }
}))
