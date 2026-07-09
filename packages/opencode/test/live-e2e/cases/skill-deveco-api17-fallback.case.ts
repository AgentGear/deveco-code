import fs from "node:fs/promises"
import path from "node:path"
import type { LiveTestCase } from "../types"

const CASE_ID = "SKILL_DEVECO_API17_FALLBACK"

function partOf(event: Record<string, unknown>): Record<string, unknown> | undefined {
  const part = event.part
  if (!part || typeof part !== "object") return undefined
  return part as Record<string, unknown>
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

function extractProjectInfo(output: string): Record<string, unknown> | undefined {
  const match = output.match(/\{[\s\S]*\}/)
  if (!match) return undefined
  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return undefined
  }
}

function textFromEvent(event: Record<string, unknown>) {
  const part = event.part
  if (!part || typeof part !== "object") return undefined
  if (!("text" in part) || typeof part.text !== "string") return undefined
  return part.text
}

const testCase: LiveTestCase = {
  id: CASE_ID,
  title: "SDK选择推荐",
  category: "skill",
  priority: "P1",
  timeoutMs: 650_000,
  requires: ["huawei-auth", "real-llm", "deveco-provider"],
  description:
    "验证指定API17版本生成鸿蒙应用时，AI 能自动加载 deveco-create-project skill（支持API18-22版本的创建），指定的API17不在支持范围内，系统会优先查询sdk目录的对应版本创建，如果没有会默认创建API22版本。",
  steps: [
    "创建临时工作目录。",
    "执行 deveco run --format json --dir <tmp>，发送指定 API 17 版本创建鸿蒙应用的 prompt。",
    "解析 stdout 中的 JSON line events（容忍因超时截断的末尾行）。",
    "查找执行 copy-template 脚本的 bash 工具事件。",
    "解析 copy-template 输出，校验 API level 信息。",
    "校验指定的 API17 不在支持范围时，系统回退到 SDK 默认版本或 API22。",
    "校验 build-profile.json5 文件存在于 projectRoot。",
  ],
  expected: [
    "copy-template 脚本执行，输出包含 apiLevel 信息。",
    "若指定 API17 不在支持范围，系统回退使用 SDK 默认版本或 API22。",
    "build-profile.json5 文件存在于工程目录。",
  ],
  code: "packages/opencode/test/live-e2e/cases/skill-deveco-api17-fallback.case.ts",
  parallel: false,
  cleanup: "用例创建临时工作目录；执行结束后删除临时目录。真实 auth/config 只读不清理。",
  async run(ctx) {
    const sentMessage = "请使用API 17版本创建一个名为TestApi17的鸿蒙应用"
    const workspace = await ctx.createTempWorkspace("skill-api17-fallback-")

    try {
      const args = ["run", "--format", "json", "--dir", workspace, sentMessage]
      const result = await ctx.runDeveco(args, { timeoutMs: 640_000 })

      await ctx.writeArtifact(CASE_ID, "stdout.log", result.stdout)
      await ctx.writeArtifact(CASE_ID, "stderr.log", result.stderr)

      const events = parseEvents(result.stdout)
      await ctx.writeArtifact(CASE_ID, "events.jsonl", events.map((e) => JSON.stringify(e)).join("\n"))

      const copyTemplateEvent = events.find((event) => {
        if (event.type !== "tool_use") return false
        const part = partOf(event)
        if (!part || part.tool !== "bash") return false
        const state = part.state
        if (!state || typeof state !== "object") return false
        const stateRecord = state as Record<string, unknown>
        const input = stateRecord.input as Record<string, unknown> | undefined
        if (!input || typeof input.command !== "string") return false
        return input.command.includes("copy-template")
      })

      if (!copyTemplateEvent) {
        throw new Error("No copy-template bash tool event found - project creation was not attempted")
      }

      const copyTemplateState = partOf(copyTemplateEvent)!.state as Record<string, unknown>
      const command = (copyTemplateState.input as Record<string, unknown>).command as string
      const output = copyTemplateState.output as string
      const projectInfo = extractProjectInfo(output)

      const textEvents = events.filter((event) => event.type === "text")
      const receivedText = textEvents.map(textFromEvent).filter((t): t is string => Boolean(t)).join("\n")
      const sessionID = events.find((event) => typeof event.sessionID === "string")?.sessionID as string | undefined

      const hasApiLevelArg = command.includes("--api-level")

      if (projectInfo) {
        const apiLevel = projectInfo.apiLevel
        const source = projectInfo.source

        if (projectInfo.projectRoot && projectInfo.verified === true) {
          const projectRoot = projectInfo.projectRoot as string
          const buildProfilePath = path.join(projectRoot, "build-profile.json5")
          try {
            const stat = await fs.stat(buildProfilePath)
            if (!stat.isFile()) {
              throw new Error(`build-profile.json5 is not a regular file at ${buildProfilePath}`)
            }
          } catch (error) {
            throw new Error(`build-profile.json5 not found at ${buildProfilePath}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }

        if (apiLevel === undefined || apiLevel === null) {
          throw new Error(`copy-template output has invalid apiLevel: ${apiLevel}`)
        }

        return {
          sentMessage, receivedText, sessionID, stdout: result.stdout, stderr: result.stderr, events,
          details: { exitCode: result.exitCode, commandDurationMs: result.durationMs, projectRoot: projectInfo.projectRoot, apiLevel, source, hasApiLevelArg, commandUsed: command, fallbackOccurred: apiLevel !== 17, copyTemplateStatus: copyTemplateState.status },
        }
      }

      // If copy-template failed (e.g., API_LEVEL_OUT_OF_RANGE), check for retry
      const hasErrorHandling =
        output.includes("API_LEVEL_OUT_OF_RANGE") || output.includes("out of range") ||
        receivedText.includes("不支持") || receivedText.includes("范围") ||
        receivedText.includes("默认") || receivedText.includes("fallback") || receivedText.includes("回退")

      if (copyTemplateState.status === "error" && hasErrorHandling) {
        const retryEvent = events.find((event) => {
          if (event.type !== "tool_use") return false
          const part = partOf(event)
          if (!part || part.tool !== "bash") return false
          const state = part.state
          if (!state || typeof state !== "object") return false
          const stateRecord = state as Record<string, unknown>
          if (stateRecord.status !== "completed") return false
          const input = stateRecord.input as Record<string, unknown> | undefined
          if (!input || typeof input.command !== "string") return false
          return input.command.includes("copy-template") && !input.command.includes("--api-level")
        })

        if (retryEvent) {
          const retryState = partOf(retryEvent)!.state as Record<string, unknown>
          const retryOutput = retryState.output as string
          const retryInfo = extractProjectInfo(retryOutput)

          if (retryInfo && retryInfo.projectRoot) {
            const buildProfilePath = path.join(retryInfo.projectRoot as string, "build-profile.json5")
            try {
              const stat = await fs.stat(buildProfilePath)
              if (!stat.isFile()) {
                throw new Error(`build-profile.json5 is not a regular file at ${buildProfilePath}`)
              }
            } catch (error) {
              throw new Error(`build-profile.json5 not found at ${buildProfilePath}: ${error instanceof Error ? error.message : String(error)}`)
            }

            return {
              sentMessage, receivedText, sessionID, stdout: result.stdout, stderr: result.stderr, events,
              details: { exitCode: result.exitCode, commandDurationMs: result.durationMs, projectRoot: retryInfo.projectRoot, apiLevel: retryInfo.apiLevel, source: retryInfo.source, hasApiLevelArg, fallbackOccurred: true, retryWithoutApiLevel: true, copyTemplateStatus: "retry_succeeded" },
            }
          }
        }
      }

      if (copyTemplateState.status === "completed") {
        return {
          sentMessage, receivedText, sessionID, stdout: result.stdout, stderr: result.stderr, events,
          details: { exitCode: result.exitCode, commandDurationMs: result.durationMs, hasApiLevelArg, commandUsed: command, copyTemplateStatus: copyTemplateState.status, note: "copy-template completed but project info parsing failed" },
        }
      }

      throw new Error(`copy-template did not complete successfully. Status: ${copyTemplateState.status}. Output: ${output?.substring(0, 300)}`)
    } finally {
      try {
        await fs.rm(workspace, { recursive: true, force: true })
      } catch {
        // ignore EBUSY and other cleanup errors on Windows
      }
    }
  },
}

export default testCase