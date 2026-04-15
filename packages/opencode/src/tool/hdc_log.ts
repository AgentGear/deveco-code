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

import z from "zod"
import { Tool } from "./tool"
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

export const HdcLogTool = Tool.define("hdc_log", async () => {
  return {
    description: DESCRIPTION,
    parameters: z.object({
      action: z.enum(["collect", "clear", "list_devices"]).describe("Action to perform"),
      device_id: z.string().optional().describe("Optional hdc target id"),
      log_prefix: z.string().default("[VCODER_DEBUG]").describe("Log prefix to filter"),
      lines: z.number().int().min(1).max(5000).default(2000).describe("Number of log lines to collect"),
    }),
    async execute(args, _ctx): Promise<{
      title: string
      output: string
      metadata: HdcLogMetadata
    }> {
      const home = await findDevEcoHome()
      if (!home) {
        throw new Error("DevEco Studio path not found. Set DEVECO_HOME and retry.")
      }
      const hdc = hdcPath(home)
      if (!(await Bun.file(hdc).exists())) {
        throw new Error(`hdc not found: ${hdc}`)
      }

      if (args.action === "list_devices") {
        const out = await run([hdc, "list", "targets"])
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
            metadata: { deviceCount: 0, lineCount: undefined },
          }
        }
        return {
          title: "Connected Devices",
          output: ["Connected devices:", ...devices.map((item, i) => `${i + 1}. ${item}`)].join("\n"),
          metadata: { deviceCount: devices.length, lineCount: undefined },
        }
      }
      if (args.action === "clear") {
        const out = await run([hdc, ...target(args.device_id), "shell", "hilog", "-r"])
        if (out.exitCode !== 0) {
          throw new Error(`hdc hilog -r failed (code=${out.exitCode}): ${out.stderr || out.stdout}`)
        }
        return {
          title: "Log Buffer Cleared",
          output: ["Device log buffer cleared.", `device: ${args.device_id || "default"}`].join("\n"),
          metadata: { deviceCount: undefined, lineCount: undefined },
        }
      }
      const out = await run([hdc, ...target(args.device_id), "shell", "hilog", "-x"])
      if (out.exitCode !== 0) {
        throw new Error(`hdc hilog -x failed (code=${out.exitCode}): ${out.stderr || out.stdout}`)
      }
      const logs = pick(out.stdout, args.log_prefix, args.lines)
      if (!logs.length) {
        return {
          title: "No Matching Logs",
          output: [
            "No matching logs found.",
            `device: ${args.device_id || "default"}`,
            `prefix: ${args.log_prefix}`,
          ].join("\n"),
          metadata: { deviceCount: undefined, lineCount: 0 },
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
        metadata: { deviceCount: undefined, lineCount: logs.length },
      }
    },
  }
})
