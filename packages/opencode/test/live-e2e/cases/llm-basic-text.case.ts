import type { LiveTestCase } from "../types"

const CASE_ID = "LLM_BASIC_TEXT"

function textFromEvent(event: Record<string, unknown>) {
  const part = event.part
  if (!part || typeof part !== "object") return undefined
  if (!("text" in part) || typeof part.text !== "string") return undefined
  return part.text
}

const testCase: LiveTestCase = {
  id: CASE_ID,
  title: "真实登录态下普通消息返回文本",
  category: "llm",
  priority: "P0",
  timeoutMs: 130_000,
  requires: ["huawei-auth", "real-llm", "deveco-provider"],
  description:
    "验证源码版 CLI 能读取本机华为 DevEco 登录态，加载 DevEco provider，发送普通消息并收到真实 LLM 文本返回。",
  steps: [
    "创建临时工作目录。",
    "执行 deveco run --format json，并发送固定 prompt。",
    "解析 stdout 中的 JSON line events。",
    "校验 text event 中包含 LIVE_TEST_OK。",
  ],
  expected: [
    "进程退出码为 0。",
    "stdout 中至少存在一个 text event。",
    "模型返回文本包含 LIVE_TEST_OK。",
  ],
  code: "packages/opencode/test/live-e2e/cases/llm-basic-text.case.ts",
  parallel: false,
  cleanup: "用例只创建临时工作目录；执行结束后删除临时目录。真实 auth/config 只读不清理。",
  async run(ctx) {
    const sentMessage = "Reply with exactly this text and nothing else: LIVE_TEST_OK"
    const result = await ctx.runDevecoPrompt(sentMessage, { timeoutMs: 120_000 })

    await ctx.writeArtifact(CASE_ID, "stdout.log", result.stdout)
    await ctx.writeArtifact(CASE_ID, "stderr.log", result.stderr)

    let events: Array<Record<string, unknown>> = []
    try {
      events = ctx.parseJsonLines(result.stdout)
    } catch (error) {
      throw new Error(`stdout is not valid JSON lines: ${error instanceof Error ? error.message : String(error)}`)
    }

    await ctx.writeArtifact(CASE_ID, "events.jsonl", events.map((event) => JSON.stringify(event)).join("\n"))

    if (result.exitCode !== 0) {
      throw new Error(`deveco run exited with ${result.exitCode}`)
    }

    const textEvents = events.filter((event) => event.type === "text")
    const receivedText = textEvents.map(textFromEvent).filter((text): text is string => Boolean(text)).join("\n")
    const sessionID = events.find((event) => typeof event.sessionID === "string")?.sessionID as string | undefined

    if (textEvents.length === 0) {
      throw new Error("No text event was emitted")
    }
    if (!receivedText.includes("LIVE_TEST_OK")) {
      throw new Error(`Expected received text to contain LIVE_TEST_OK, got: ${receivedText || "(empty)"}`)
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
      },
    }
  },
}

export default testCase
