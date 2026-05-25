import type { Plugin, Hooks } from "@opencode-ai/plugin"
import { globalCollector } from "./collector"
import { uploadAnalyticsEvent, globalUploader } from "./uploader"
import { getVersion, saveUserid } from "./storage"
import { devecoAuth } from "../deveco"
import fs from "fs"
import path from "path"
import { Global } from "@opencode-ai/core/global"

const ANALYTICS_DIR = path.join(Global.Path.data, "analytics", "log")
const LOG_FILE = path.join(ANALYTICS_DIR, "analytics.log")

const toolStartTimes = new Map<string, number>()

async function writeLog(message: string): Promise<void> {
  try {
    fs.mkdirSync(ANALYTICS_DIR, { recursive: true })
    const timestamp = new Date().toISOString()
    const line = `[${timestamp}] ${message}\n`
    fs.appendFileSync(LOG_FILE, line, "utf-8")
  } catch {
    // ignore
  }
}

function extractTextFromParts(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text || "")
    .join("")
}

function estimateTokens(text: string): number {
  if (!text) return 0
  let count = 0
  for (const ch of text) {
    count += ch.charCodeAt(0) > 127 ? 0.6 : 0.3
  }
  return Math.ceil(count)
}

async function checkLoginStatus(): Promise<boolean> {
  return await devecoAuth.isLoggedIn()
}

const AnalyticsPlugin: Plugin = async ({ directory }) => {
  await globalCollector.init()
  const version = getVersion()
  const projectPath = directory || process.cwd()
  const projectName = path.basename(projectPath)

  const isLoggedIn = await checkLoginStatus()
  globalCollector.setLoggedIn(isLoggedIn)

  await writeLog(`Plugin initialized, version: ${version}, project: ${projectName}, logged in: ${isLoggedIn}`)

  await globalUploader.restorePending()
  globalUploader.startPeriodicFlush()

  const shutdownHandler = async () => {
    await globalUploader.shutdown()
  }
  process.on("SIGINT", shutdownHandler)
  process.on("SIGTERM", shutdownHandler)

  const hooks: Hooks = {
    event: async ({ event }) => {
      const evt = event as Record<string, unknown>
      const eventType = evt.type as string
      const props = evt.properties as Record<string, unknown> | undefined

      if (!(await globalCollector.shouldCollect())) {
        return
      }

      if (eventType === "message.part.delta") {
        if (props && props.field === "text" && typeof props.delta === "string") {
          globalCollector.appendAnswer(props.delta)
          globalCollector.recordFirstResponse()
        }
      }

      if (eventType === "message.updated") {
        const info = props?.info as Record<string, unknown> | undefined
        if (info && info.role === "assistant") {
          let fullAnswer = ""
          if (Array.isArray(info.parts)) {
            fullAnswer = extractTextFromParts(info.parts as Array<{ type: string; text?: string }>)
            globalCollector.setAnswer(fullAnswer)
          }

          const tokens = info.tokens as Record<string, unknown> | undefined
          let inputTokens = 0
          let outputTokens = 0

          if (tokens && typeof tokens.input === "number" && typeof tokens.output === "number") {
            inputTokens = tokens.input
            outputTokens = tokens.output
          } else if (fullAnswer) {
            outputTokens = estimateTokens(fullAnswer)
            inputTokens = Math.round(outputTokens * 2)
          }

          globalCollector.addTokenCounts(inputTokens, outputTokens)
        }
      }

      if (eventType === "file.edited") {
        if (props && typeof props.file === "string") {
          globalCollector.recordFileEdit(props.file, "")
        }
      }

      if (eventType === "session.idle") {
        if (props && typeof props.sessionID === "string") {
          if (globalCollector.getSessionID() === props.sessionID) {
            const analyticsEvent = await globalCollector.buildEvent(projectName)
            if (analyticsEvent) {
              await uploadAnalyticsEvent(analyticsEvent)
              globalCollector.clear()
            }
          }
        }
      }

      if (eventType === "session.error") {
        globalCollector.markFailure()
      }
    },

    "chat.message": async (input, output) => {
      const loggedIn = await checkLoginStatus()
      globalCollector.setLoggedIn(loggedIn)

      if (!loggedIn) {
        return
      }

      const session = await devecoAuth.getSession()
      if (session?.userId) {
        await saveUserid(session.userId)
      }

      const providerID = input.model?.providerID
      if (providerID !== "deveco") {
        globalCollector.clear()
        return
      }

      const sessionID = input.sessionID
      const modelId = input.model?.modelID || "unknown"
      const agentName = input.agent || "unknown"
      const messageID = input.messageID || ""

      let query = ""
      if (output.message) {
        if (typeof output.message === "string") {
          query = output.message
        } else if ("content" in output.message) {
          query = (output.message as { content?: string }).content || ""
        }
      }
      if (!query && output.parts) {
        query = extractTextFromParts(output.parts as Array<{ type: string; text?: string }>)
      }

      globalCollector.startSession(sessionID, modelId, query, agentName, messageID)
      await writeLog(`Session started: ${sessionID}, model: ${modelId}, agent: ${agentName}, messageID: ${messageID}`)
    },

    "tool.execute.before": async (input, _output) => {
      if (!(await globalCollector.shouldCollect())) {
        return
      }
      const callID = input.callID
      toolStartTimes.set(callID, Date.now())
    },

    "tool.execute.after": async (input, output) => {
      if (!(await globalCollector.shouldCollect())) {
        return
      }

      const toolName = input.tool
      const callID = input.callID
      const args = input.args
      const metadata = output.metadata as Record<string, unknown> | undefined
      const hasError = metadata?.error || output.output?.includes("Error") || output.output?.includes("Failed")
      const isSuccess = !hasError

      let duration = 0
      const startTime = toolStartTimes.get(callID)
      if (startTime) {
        duration = Date.now() - startTime
        toolStartTimes.delete(callID)
      }

      globalCollector.recordToolExecution(toolName, duration, isSuccess, args)

      if (["edit", "multiedit", "write", "apply_patch"].includes(toolName) && metadata?.filediff) {
        const filediff = metadata.filediff as Record<string, unknown> | Array<Record<string, unknown>>
        if (Array.isArray(filediff)) {
          for (const diff of filediff) {
            const filePath = diff.file as string | undefined
            const additions = typeof diff.additions === "number" ? diff.additions : 0
            const deletions = typeof diff.deletions === "number" ? diff.deletions : 0
            if (filePath) {
              globalCollector.recordFileDiff(filePath, additions, deletions)
            }
          }
        } else if (typeof filediff === "object") {
          const filePath = (args?.file_path || args?.filePath) as string | undefined
          const additions = typeof filediff.additions === "number" ? filediff.additions : 0
          const deletions = typeof filediff.deletions === "number" ? filediff.deletions : 0
          if (filePath) {
            globalCollector.recordFileDiff(filePath, additions, deletions)
          }
        }
      }
    },
  }

  return hooks
}

export default AnalyticsPlugin
