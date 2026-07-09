import type { LiveTestCase } from "../types"
import fs from "node:fs/promises"

const CASE_ID = "SKILL_ERROR_TYPE_MISMATCH"

function textFromEvent(event: Record<string, unknown>) {
  const part = event.part
  if (!part || typeof part !== "object") return undefined
  if (!("text" in part) || typeof part.text !== "string") return undefined
  return part.text
}

function parseEvents(stdout: string): Array<Record<string, unknown>> {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>]
      } catch {
        return []
      }
    })
}

const testCase: LiveTestCase = {
  id: CASE_ID,
  title: "类型错误修复",
  category: "skill",
  priority: "P1",
  timeoutMs: 200_000,
  requires: ["huawei-auth", "real-llm", "deveco-provider"],
  description:
    "验证输入包含类型错误的代码（如 let num: number = \"hello\"），AI 能自动加载 arkts-error-fixes skill 并返回修正类型或值的修复建议。",
  steps: [
    "创建临时工作目录。",
    "执行 deveco run --format json --dir <tmp>，发送包含类型错误的代码。",
    "解析 stdout 中的 JSON line events。",
    "校验 text event 中包含类型修正建议（修改类型声明或修改赋值值）。",
  ],
  expected: [
    "进程正常退出或超时前有 text event 输出。",
    "模型返回文本包含类型修正建议（number 或 string 类型相关）。",
  ],
  code: "packages/opencode/test/live-e2e/cases/skill-error-type-mismatch.case.ts",
  parallel: false,
  cleanup: "用例只创建临时工作目录；执行结束后删除临时目录。真实 auth/config 只读不清理。",
  async run(ctx) {
    const sentMessage = [
      "以下 ArkTS 代码存在类型错误，请修复：",
      "let num: number = \"hello\"",
    ].join("\n")

    const workspace = await ctx.createTempWorkspace("skill-error-type-")

    try {
      const args = ["run", "--format", "json", "--dir", workspace, sentMessage]
      const result = await ctx.runDeveco(args, { timeoutMs: 190_000 })

      await ctx.writeArtifact(CASE_ID, "stdout.log", result.stdout)
      await ctx.writeArtifact(CASE_ID, "stderr.log", result.stderr)

      const events = parseEvents(result.stdout)
      await ctx.writeArtifact(CASE_ID, "events.jsonl", events.map((e) => JSON.stringify(e)).join("\n"))

      const textEvents = events.filter((event) => event.type === "text")
      const receivedText = textEvents.map(textFromEvent).filter((t): t is string => Boolean(t)).join("\n")
      const sessionID = events.find((event) => typeof event.sessionID === "string")?.sessionID as
        | string
        | undefined

      if (textEvents.length === 0) {
        throw new Error("No text event was emitted")
      }

      const hasTypeFix =
        receivedText.toLowerCase().includes("string") ||
        receivedText.toLowerCase().includes("number") ||
        receivedText.toLowerCase().includes("类型")

      if (!hasTypeFix) {
        throw new Error(
          `Expected response to contain type fix suggestion (string/number/类型), got: ${receivedText.substring(0, 300)}...`,
        )
      }

      return {
        sentMessage,
        receivedText,
        sessionID,
        stdout: result.stdout,
        stderr: result.stderr,
        events,
        details: {
          exitCode: result.exitCode,
          commandDurationMs: result.durationMs,
          textEventCount: textEvents.length,
          workspace,
        },
      }
    } finally {
      try {
        await fs.rm(workspace, { recursive: true, force: true })
      } catch {
        // ignore cleanup errors
      }
    }
  },
}

export default testCase