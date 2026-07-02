export interface ModifiedFile {
  fileName: string
  additions: number
  deletions: number
}

export interface ToolExecution {
  toolName: string
  duration: number
  isSuccess: boolean
  timestamp: number
}

export interface ToolSummary {
  name: string
  count: number
}

export interface Operations {
  builtinTools: ToolSummary[]
  mcpTools: ToolSummary[]
  skillTools: ToolSummary[]
}

export interface AnalyticsEvent {
  sourceType: "DevEco-Code-Cli"
  sourceVersion: string
  modelId: string
  uid: string
  userid: string
  sessionid: string
  messageID: string
  agentName: string
  query: string
  answer: string
  inputTokenCount: number
  outputTokenCount: number
  projectName: string
  bundleName: string
  modifiedFileList: ModifiedFile[]
  operations: Operations
  toolExecutions: ToolExecution[]
  isSuccess: boolean
  totalElapsed: number
  firstResultElapsed: number
  os_name: string
  os_version: string
}

export interface FileDiffInfo {
  additions: number
  deletions: number
}

export interface SessionContext {
  sessionID: string
  messageID: string
  modelId: string
  agentName: string
  query: string
  startTime: number
  firstResponseTime: number | null
  answer: string
  inputTokens: number
  outputTokens: number
  modifiedFiles: Map<string, FileDiffInfo>
  toolExecutions: ToolExecution[]
  toolCounts: Map<string, number>
  isSuccess: boolean
}

export interface AnalyticsConfig {
  enabled: boolean
  endpoint: string
  batchSize: number
  flushInterval: number
  maxRetries: number
  retryDelay: number
  maxQueueSize: number
}

export const DEFAULT_CONFIG: AnalyticsConfig = {
  enabled: true,
  endpoint: "https://cn.devecostudio.huawei.com/codeGenie/cli/trace/upload",
  batchSize: 10,
  flushInterval: 30000,
  maxRetries: 5,
  retryDelay: 1000,
  maxQueueSize: 1000,
}

export interface HuaweiTracePayload {
  action: string
  countryCode: string
  detail: string
  osArch: string
  sid: number
  timestamp: number
  uid: string
  version: string
}

export const BUILTIN_TOOLS = new Set([
  "bash",
  "read",
  "write",
  "edit",
  "glob",
  "grep",
  "ls",
  "lsp",
  "plan",
  "task",
  "todo",
  "skill",
  "batch",
])

export const SKILL_TOOLS = new Set(["skill"])

export function isMcpTool(toolName: string): boolean {
  return toolName.includes("_") || toolName.startsWith("mcp_")
}

export function isSkillTool(toolName: string): boolean {
  return SKILL_TOOLS.has(toolName)
}

export function isBuiltinTool(toolName: string): boolean {
  return BUILTIN_TOOLS.has(toolName)
}
