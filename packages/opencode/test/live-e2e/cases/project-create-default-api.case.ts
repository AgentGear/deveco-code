import fs from "node:fs/promises"
import path from "node:path"
import type { LiveTestCase } from "../types"

const CASE_ID = "PROJECT_CREATE_DEFAULT_API"

function partOf(event: Record<string, unknown>): Record<string, unknown> | undefined {
  const part = event.part
  if (!part || typeof part !== "object") return undefined
  return part as Record<string, unknown>
}

// Tolerant JSON-line parser: skips truncated lines from a process killed mid-stream
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

const testCase: LiveTestCase = {
  id: CASE_ID,
  title: "参数完整，无自定义apiLevel",
  category: "skill",
  priority: "P0",
  timeoutMs: 650_000,
  requires: ["huawei-auth", "real-llm", "deveco-provider"],
  description:
    "验证通过自然语言指令创建鸿蒙工程时，参数完整且不指定自定义 apiLevel，系统能自动检测 SDK apiLevel，成功创建工程、输出完整信息、生成 build-profile.json5 并切换 cwd。",
  steps: [
    "创建临时工作目录。",
    "执行 deveco run --format json --dir <tmp>，发送创建 HelloWorld 鸿蒙应用的 prompt（不指定 apiLevel）。",
    "解析 stdout 中的 JSON line events（容忍因超时截断的末尾行）。",
    "查找执行 copy-template 脚本的 bash 工具事件，校验命令中不含 --api-level。",
    "解析 copy-template 输出，校验包含完整工程信息（projectRoot、appName、bundleName、apiLevel、source 等）。",
    "校验 source 为 sdk_pkg（自动检测），verified 为 true。",
    "校验 build-profile.json5 文件存在于 projectRoot。",
    "校验已切换 cwd（copy-template 输出包含 auto-switched 信息或存在 switch_cwd 工具事件）。",
  ],
  expected: [
    "成功创建工程，copy-template 脚本执行成功且 verified 为 true。",
    "输出完整信息，包含 projectRoot、appName、bundleName、apiLevel、source 等字段。",
    "build-profile.json5 文件存在于工程目录。",
    "已切换 cwd，输出包含 Session directory auto-switched 或存在 switch_cwd 工具事件。",
  ],
  code: "packages/opencode/test/live-e2e/cases/project-create-default-api.case.ts",
  parallel: false,
  cleanup: "用例创建临时工作目录；执行结束后删除临时目录。真实 auth/config 只读不清理。",
  async run(ctx) {
    const sentMessage =
      "请在当前工作目录从0到1生成一个名为HelloWorld的鸿蒙应用，提供一个简洁的HelloWorld页面，最后完成编译并尝试运行，如受环境限制请明确说明原因"

    const workspace = await ctx.createTempWorkspace()

    try {
      const result = await ctx.runDevecoPrompt(sentMessage, { timeoutMs: 600_000, workspace })

      
      await ctx.writeArtifact(CASE_ID, "stdout.log", result.stdout)
      await ctx.writeArtifact(CASE_ID, "stderr.log", result.stderr)

      const events = parseEvents(result.stdout)
      await ctx.writeArtifact(CASE_ID, "events.jsonl", events.map((event) => JSON.stringify(event)).join("\n"))

      // Find the bash event that ran copy-template.mjs with completed status
      const copyTemplateEvent = events.find((event) => {
        if (event.type !== "tool_use") return false
        const part = partOf(event)
        if (!part || part.tool !== "bash") return false
        const state = part.state
        if (!state || typeof state !== "object") return false
        const stateRecord = state as Record<string, unknown>
        if (stateRecord.status !== "completed") return false
        const input = stateRecord.input as Record<string, unknown> | undefined
        if (!input || typeof input.command !== "string") return false
        return input.command.includes("copy-template")
      })

      if (!copyTemplateEvent) {
        throw new Error("No completed copy-template bash tool event found - project was not created successfully")
      }

      const copyTemplateState = partOf(copyTemplateEvent)!.state as Record<string, unknown>
      const command = (copyTemplateState.input as Record<string, unknown>).command as string

      // Verify no custom apiLevel was passed (auto-detection expected)
      if (command.includes("--api-level")) {
        throw new Error("copy-template command contains --api-level, expected auto-detection without custom apiLevel")
      }

      // Parse the copy-template output to get project info
      const output = copyTemplateState.output as string
      const projectInfo = extractProjectInfo(output)

      if (!projectInfo) {
        throw new Error("Failed to parse copy-template output for project info")
      }

      // Verify complete info output (all required fields present)
      const requiredFields = ["projectRoot", "appName", "bundleName", "apiLevel", "source"]
      const missingFields = requiredFields.filter((field) => !(field in projectInfo))
      if (missingFields.length > 0) {
        throw new Error(`copy-template output missing fields: ${missingFields.join(", ")}`)
      }

      // Verify auto-detected apiLevel (source = sdk_pkg, not user_input)
      if (projectInfo.source !== "sdk_pkg") {
        throw new Error(`Expected source=sdk_pkg (auto-detected), got source=${projectInfo.source}`)
      }

      // Verify the script confirmed build-profile.json5 exists
      if (projectInfo.verified !== true) {
        throw new Error("copy-template output indicates project was not verified (verified !== true)")
      }

      // Verify build-profile.json5 exists on disk
      const projectRoot = projectInfo.projectRoot as string
      const buildProfilePath = path.join(projectRoot, "build-profile.json5")
      try {
        const stat = await fs.stat(buildProfilePath)
        if (!stat.isFile()) {
          throw new Error(`build-profile.json5 is not a regular file at ${buildProfilePath}`)
        }
      } catch (error) {
        throw new Error(
          `build-profile.json5 not found at ${buildProfilePath}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      // Verify cwd was switched: either auto-switched by copy-template or explicit switch_cwd tool call
      const autoSwitched = output.includes("Session directory auto-switched")
      const hasSwitchCwdEvent = events.some((event) => {
        if (event.type !== "tool_use") return false
        const part = partOf(event)
        if (!part || part.tool !== "switch_cwd") return false
        const state = part.state
        if (!state || typeof state !== "object") return false
        return (state as Record<string, unknown>).status === "completed"
      })

      if (!autoSwitched && !hasSwitchCwdEvent) {
        throw new Error("cwd was not switched - no auto-switch message and no switch_cwd tool event found")
      }

      const sessionID = events.find((event) => typeof event.sessionID === "string")?.sessionID as
        | string
        | undefined

      return {
        sentMessage,
        sessionID,
        stdout: result.stdout,
        stderr: result.stderr,
        events,
        details: {
          exitCode: result.exitCode,
          commandDurationMs: result.durationMs,
          projectRoot,
          buildProfilePath,
          apiLevel: projectInfo.apiLevel,
          sdkVersion: projectInfo.sdkVersion,
          source: projectInfo.source,
          autoSwitched,
          hasSwitchCwdEvent,
        },
      }
    } finally {
      await fs.rm(workspace, { recursive: true, force: true })
    }
  },
}

export default testCase
