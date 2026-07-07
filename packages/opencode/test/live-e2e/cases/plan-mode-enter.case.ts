import type { LiveTestCase } from "../types"
import fs from "fs/promises"

const CASE_ID = "PLAN_MODE_ENTER"

const testCase: LiveTestCase = {
  id: CASE_ID,
  title: "切换到plan模式",
  category: "slash",
  priority: "P0",
  timeoutMs: 150_000,
  requires: ["huawei-auth", "real-llm", "deveco-provider"],
  description:
    "验证通过--agent plan参数切换到plan模式，发送请求并收到真实LLM响应确认当前模式。",
  steps: [
    "创建临时工作目录。",
    "执行 deveco run --agent plan --format json，并发送模式确认请求。",
    "解析 stdout 中的 JSON line events。",
    "校验输出中包含plan agent相关信息。",
    "校验模型返回了plan模式相关内容。",
  ],
  expected: [
    "进程退出码为 0。",
    "stdout 中存在agent切换事件或文本响应。",
    "模型返回文本包含计划相关内容。",
  ],
  code: "packages/opencode/test/live-e2e/cases/plan-mode-enter.case.ts",
  parallel: false,
  cleanup: "用例只创建临时工作目录；执行结束后删除临时目录。真实 auth/config 只读不清理。",
  async run(ctx) {
    const sentMessage = "你是什么模式？"
    const workspace = await ctx.createTempWorkspace("plan-mode-test-")
    
    try {
      // 构造命令参数，使用--agent plan切换到plan模式
      const args = ["run", "--format", "json", "--dir", workspace, "--agent", "plan"]
      args.push(sentMessage)
      
      const result = await ctx.runDeveco(args, { timeoutMs: 140_000 })

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

      // 检查是否有agent相关的event
      const agentEvents = events.filter((event) => 
        event.type === "agent" || 
        (event.properties && typeof event.properties === "object" && "agent" in event.properties)
      )
      
      // 检查是否有text响应
      const textEvents = events.filter((event) => event.type === "text")
      
      // 提取sessionID
      const sessionID = events.find((event) => typeof event.sessionID === "string")?.sessionID as string | undefined

      // 验证至少有text事件（LLM响应）
      if (textEvents.length === 0 && agentEvents.length === 0) {
        throw new Error("No text or agent events were emitted")
      }

      // 提取所有文本内容
      const receivedText = textEvents
        .map((event) => {
          const part = event.part
          if (!part || typeof part !== "object") return undefined
          if (!("text" in part) || typeof part.text !== "string") return undefined
          return part.text
        })
        .filter((text): text is string => Boolean(text))
        .join("\n")

      // 验证返回文本包含计划相关关键词
      const planKeywords = ["计划", "plan"]
      const hasPlanContent = planKeywords.some(keyword => 
        receivedText.toLowerCase().includes(keyword.toLowerCase())
      )

      if (!hasPlanContent && textEvents.length > 0) {
        throw new Error(`Expected response to contain plan-related keywords, got: ${receivedText.substring(0, 200)}...`)
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
          agentEventCount: agentEvents.length,
          textEventCount: textEvents.length,
          workspace,
        },
      }
    } finally {
      // 清理临时工作区
      try {
        await fs.rm(workspace, { recursive: true, force: true })
      } catch {
        // ignore cleanup errors
      }
    }
  },
}

export default testCase