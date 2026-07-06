import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { CaseContext, RunCommandResult } from "./types"

export const opencodeRoot = path.resolve(import.meta.dir, "../..")
export const repoRoot = path.resolve(opencodeRoot, "../..")
export const cliEntry = path.join(opencodeRoot, "src/index.ts")
export const latestReportDir = path.join(repoRoot, "reports", "live-e2e", "latest")
export const artifactDir = path.join(latestReportDir, "artifacts")

export function realUserEnv() {
  const env = { ...process.env }

  delete env.DEVECO_TEST_HOME
  delete env.DEVECO_AUTH_CONTENT
  delete env.DEVECO_MODELS_PATH
  delete env.DEVECO_DB
  delete env.XDG_DATA_HOME
  delete env.XDG_CACHE_HOME
  delete env.XDG_CONFIG_HOME
  delete env.XDG_STATE_HOME

  return {
    ...env,
    DEVECO_DISABLE_AUTOUPDATE: "1",
    DEVECO_DISABLE_AUTOCOMPACT: "1",
    DEVECO_DISABLE_PROJECT_CONFIG: "1",
    DEVECO_DISABLE_MODELS_FETCH: "1",
  }
}

export async function resetReportDir() {
  await fs.rm(latestReportDir, { recursive: true, force: true })
  await fs.mkdir(artifactDir, { recursive: true })
}

export async function createTempWorkspace(prefix = "deveco-live-e2e-") {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

export async function runDeveco(
  args: string[],
  options: { timeoutMs?: number; cwd?: string } = {},
): Promise<RunCommandResult> {
  const start = Date.now()
  const proc = Bun.spawn(["bun", "run", "--conditions=browser", cliEntry, ...args], {
    cwd: options.cwd ?? opencodeRoot,
    env: realUserEnv(),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  })

  const timeout = setTimeout(() => proc.kill(), options.timeoutMs ?? 120_000)
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]).finally(() => clearTimeout(timeout))

  return { exitCode, stdout, stderr, durationMs: Date.now() - start }
}

export async function runDevecoPrompt(
  message: string,
  options: { timeoutMs?: number; model?: string; workspace?: string } = {},
) {
  const workspace = options.workspace ?? (await createTempWorkspace())
  const ownsWorkspace = options.workspace === undefined
  try {
    const args = ["run", "--format", "json", "--dir", workspace]
    const model = options.model ?? process.env.DEVECO_LIVE_MODEL?.trim()
    if (model) args.push("--model", model)
    args.push(message)
    return await runDeveco(args, { timeoutMs: options.timeoutMs })
  } finally {
    if (ownsWorkspace) await fs.rm(workspace, { recursive: true, force: true })
  }
}

export function parseJsonLines(stdout: string) {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

export async function writeArtifact(caseID: string, filename: string, content: string) {
  const safeCaseID = caseID.replace(/[^a-zA-Z0-9._-]/g, "_")
  const file = path.join(artifactDir, `${safeCaseID}.${filename}`)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, content)
  return file
}

export function makeContext(): CaseContext {
  return {
    reportDir: latestReportDir,
    artifactDir,
    createTempWorkspace,
    writeArtifact,
    runDeveco,
    runDevecoPrompt,
    parseJsonLines,
  }
}

export async function collectEnvironment() {
  const [paths, auth] = await Promise.all([
    runDeveco(["debug", "paths"], { timeoutMs: 30_000 }),
    runDeveco(["auth", "list"], { timeoutMs: 30_000 }),
  ])

  const authStdout = auth.stdout.toLowerCase()

  return {
    liveEnabled: process.env.DEVECO_LIVE_LLM === "1",
    selectedModel: process.env.DEVECO_LIVE_MODEL || "(default)",
    opencodeRoot,
    reportDir: latestReportDir,
    paths: {
      exitCode: paths.exitCode,
      stdout: paths.stdout,
      stderr: paths.stderr,
    },
    auth: {
      exitCode: auth.exitCode,
      stdout: auth.stdout,
      stderr: auth.stderr,
      hasDevecoOAuth:
        auth.exitCode === 0 &&
        authStdout.includes("oauth") &&
        (authStdout.includes("deveco code") || authStdout.includes("deveco")),
    },
  }
}
