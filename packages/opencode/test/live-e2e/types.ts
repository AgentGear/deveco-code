export type Requirement = "huawei-auth" | "real-llm" | "deveco-provider"

export type TestStatus = "passed" | "failed" | "skipped"

export type RunCommandResult = {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
}

export type CaseRunResult = {
  sentMessage?: string
  receivedText?: string
  sessionID?: string
  stdout?: string
  stderr?: string
  events?: Array<Record<string, unknown>>
  details?: Record<string, unknown>
}

export type CaseContext = {
  reportDir: string
  artifactDir: string
  createTempWorkspace: (prefix?: string) => Promise<string>
  writeArtifact: (caseID: string, filename: string, content: string) => Promise<string>
  runDeveco: (args: string[], options?: { timeoutMs?: number; cwd?: string; stdin?: string }) => Promise<RunCommandResult>
  runDevecoPrompt: (
    message: string,
    options?: { timeoutMs?: number; model?: string; workspace?: string },
  ) => Promise<RunCommandResult>
  parseJsonLines: (stdout: string) => Array<Record<string, unknown>>
}

export type LiveTestCase = {
  id: string
  title: string
  category: "llm" | "skill" | "slash" | "cli"
  priority: "P0" | "P1" | "P2"
  timeoutMs: number
  requires: Requirement[]
  description: string
  steps: string[]
  expected: string[]
  code: string
  parallel?: boolean
  cleanup: string
  run: (ctx: CaseContext) => Promise<CaseRunResult>
}

export type ExecutedCase = {
  case: LiveTestCase
  status: TestStatus
  durationMs: number
  error?: string
  skipReason?: string
  result?: CaseRunResult
  artifacts: Record<string, string>
}

export type SuiteSummary = {
  total: number
  passed: number
  failed: number
  skipped: number
  durationMs: number
  startedAt: string
  finishedAt: string
}

export type SuiteReport = {
  summary: SuiteSummary
  cases: ExecutedCase[]
  environment: Record<string, unknown>
}
