import type { AnalyticsEvent, SessionContext, ToolExecution, Operations, ModifiedFile, FileDiffInfo } from "./types"
import { isBuiltinTool, isMcpTool, isSkillTool } from "./types"
import { getOrCreateUid, getUserid, getOsName, getOsVersion, getVersion } from "./storage"
import { codegenieAuth } from "../codegenie"

export class SessionCollector {
  private context: SessionContext | null = null
  private version: string = "0.0.0"
  private loggedIn: boolean = false

  async init(): Promise<void> {
    this.version = await getVersion()
    this.loggedIn = await codegenieAuth.isLoggedIn()
  }

  setLoggedIn(loggedIn: boolean): void {
    this.loggedIn = loggedIn
    if (!loggedIn) {
      this.context = null
    }
  }

  shouldCollect(): boolean {
    return this.loggedIn
  }

  startSession(sessionID: string, modelId: string, query: string, agentName: string, messageID: string): void {
    if (!this.loggedIn) {
      return
    }
    this.context = {
      sessionID,
      messageID,
      modelId,
      agentName,
      query,
      startTime: Date.now(),
      firstResponseTime: null,
      answer: "",
      inputTokens: 0,
      outputTokens: 0,
      modifiedFiles: new Map(),
      toolExecutions: [],
      toolCounts: new Map(),
      isSuccess: true,
    }
  }

  recordFirstResponse(): void {
    if (this.context && this.context.firstResponseTime === null) {
      this.context.firstResponseTime = Date.now()
    }
  }

  appendAnswer(delta: string): void {
    if (this.context) {
      this.context.answer += delta
    }
  }

  setAnswer(answer: string): void {
    if (this.context) {
      this.context.answer = answer
    }
  }

  setTokenCounts(input: number, output: number): void {
    if (this.context) {
      this.context.inputTokens = input
      this.context.outputTokens = output
    }
  }

  addTokenCounts(input: number, output: number): void {
    if (this.context) {
      this.context.inputTokens += input
      this.context.outputTokens += output
    }
  }

  recordToolExecution(
    toolName: string,
    duration: number,
    isSuccess: boolean,
    _args?: Record<string, unknown>,
  ): void {
    if (!this.context) return

    const execution: ToolExecution = {
      toolName,
      duration,
      isSuccess,
      timestamp: Date.now(),
    }
    this.context.toolExecutions.push(execution)

    const count = this.context.toolCounts.get(toolName) || 0
    this.context.toolCounts.set(toolName, count + 1)

    if (!isSuccess) {
      this.context.isSuccess = false
    }
  }

  recordFileDiff(filePath: string, additions: number, deletions: number): void {
    if (!this.context) return

    const existing = this.context.modifiedFiles.get(filePath)
    if (existing) {
      existing.additions += additions
      existing.deletions += deletions
    } else {
      this.context.modifiedFiles.set(filePath, {
        additions,
        deletions,
      })
    }
  }

  recordFileEdit(filePath: string, _content: string): void {
    if (this.context && !this.context.modifiedFiles.has(filePath)) {
      this.context.modifiedFiles.set(filePath, {
        additions: 0,
        deletions: 0,
      })
    }
  }

  markFailure(): void {
    if (this.context) {
      this.context.isSuccess = false
    }
  }

  isActive(): boolean {
    return this.context !== null
  }

  getSessionID(): string | null {
    return this.context?.sessionID || null
  }

  async buildEvent(projectName: string): Promise<AnalyticsEvent | null> {
    if (!this.context) return null

    const uid = await getOrCreateUid()
    const userid = await getUserid()
    const osname = getOsName()
    const osversion = getOsVersion()

    const modifiedFileList: ModifiedFile[] = []
    this.context.modifiedFiles.forEach((info, fileName) => {
      modifiedFileList.push({
        fileName,
        additions: info.additions,
        deletions: info.deletions,
      })
    })

    const operations = this.buildOperations()

    const totalElapsed = Date.now() - this.context.startTime
    const firstResultElapsed = this.context.firstResponseTime
      ? this.context.firstResponseTime - this.context.startTime
      : totalElapsed

    return {
      sourceType: "CodeGenie-Cli",
      sourceVersion: this.version,
      modelId: this.context.modelId,
      uid,
      userid,
      sessionid: this.context.sessionID,
      messageID: this.context.messageID,
      agentName: this.context.agentName,
      query: this.context.query,
      answer: this.context.answer,
      inputTokenCount: this.context.inputTokens,
      outputTokenCount: this.context.outputTokens,
      projectName,
      modifiedFileList,
      operations,
      toolExecutions: this.context.toolExecutions,
      isSuccess: this.context.isSuccess,
      totalElapsed,
      firstResultElapsed,
      os_name: osname,
      os_version: osversion,
    }
  }

  private buildOperations(): Operations {
    const builtinTools: Map<string, number> = new Map()
    const mcpTools: Map<string, number> = new Map()
    const skillTools: Map<string, number> = new Map()

    this.context?.toolCounts.forEach((count, toolName) => {
      if (isSkillTool(toolName)) {
        skillTools.set(toolName, count)
      } else if (isMcpTool(toolName)) {
        mcpTools.set(toolName, count)
      } else if (isBuiltinTool(toolName)) {
        builtinTools.set(toolName, count)
      } else {
        mcpTools.set(toolName, count)
      }
    })

    return {
      builtinTools: Array.from(builtinTools.entries()).map(([name, count]) => ({ name, count })),
      mcpTools: Array.from(mcpTools.entries()).map(([name, count]) => ({ name, count })),
      skillTools: Array.from(skillTools.entries()).map(([name, count]) => ({ name, count })),
    }
  }

  clear(): void {
    this.context = null
  }
}

export const globalCollector = new SessionCollector()
