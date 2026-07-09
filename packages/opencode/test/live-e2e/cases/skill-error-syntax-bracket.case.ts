import type { LiveTestCase } from "../types"
import fs from "node:fs/promises"

const CASE_ID = "SKILL_ERROR_SYNTAX_BRACKET"

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
  title: "语法错误修复",
  category: "skill",
  priority: "P1",
  timeoutMs: 200_000,
  requires: ["huawei-auth", "real-llm", "deveco-provider"],
  description:
    "验证输入缺少闭合括号的组件代码，AI 能自动加载 arkts-error-fixes skill 并指出需要添加缺失的 } 括号。",
  steps: [
    "创建临时工作目录。",
    "执行 deveco run --format json --dir <tmp>，发送缺少闭合括号的组件代码。",
    "解析 stdout 中的 JSON line events。",
    "校验 text event 中指出需要添加缺失的 } 括号。",
  ],
  expected: [
    "进程正常退出或超时前有 text event 输出。",
    "模型返回文本包含 } 括号修复建议或语法错误指出。",
  ],
  code: "packages/opencode/test/live-e2e/cases/skill-error-syntax-bracket.case.ts",
  parallel: false,
  cleanup: "用例只创建临时工作目录；执行结束后删除临时目录。真实 auth/config 只读不清理。",
  async run(ctx) {
    const sentMessage = [
      "以下 ArkTS 组件代码缺少闭合括号，请修复：",
      "@Entry",
      "@Component",
      "struct MyPage {",
      "  build() {",
      "    Column() {",
      "      Text('Hello')",
      "    }",
    ].join("\n")

    const workspace = await ctx.createTempWorkspace("skill-error-syntax-")

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

      const hasBracketFix =
        receivedText.includes("}") &&
        (receivedText.includes("闭合") ||
          receivedText.includes("括号") ||
          receivedText.includes("缺少") ||
          receivedText.includes("缺失") ||
          receivedText.includes("补") ||
          receivedText.toLowerCase().includes("closing") ||
          receivedText.toLowerCase().includes("missing") ||
          receivedText.toLowerCase().includes("brace") ||
          receivedText.toLowerCase().includes("bracket"))

      if (!hasBracketFix) {
        throw new Error(
          `Expected response to mention adding missing } bracket, got: ${receivedText.substring(0, 300)}...`,
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