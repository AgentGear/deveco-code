import { cases } from "./registry"
import { collectEnvironment, makeContext, resetReportDir, latestReportDir } from "./env"
import { writeReports } from "./report"
import type { ExecutedCase, LiveTestCase, SuiteReport } from "./types"

function parseArgs(argv: string[]) {
  const result: { caseID?: string; category?: string; list?: boolean } = {}
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === "--case") result.caseID = argv[++index]
    else if (arg === "--category") result.category = argv[++index]
    else if (arg === "--list") result.list = true
  }
  return result
}

function duration(start: number) {
  return Date.now() - start
}

function skipReason(testCase: LiveTestCase, env: Awaited<ReturnType<typeof collectEnvironment>>) {
  if (testCase.requires.includes("real-llm") && !env.liveEnabled) {
    return "DEVECO_LIVE_LLM=1 is required for real LLM cases"
  }
  if (testCase.requires.includes("huawei-auth") && !env.auth.hasDevecoOAuth) {
    return "DevEco Huawei OAuth credential was not found. Run `bun run --conditions=browser src/index.ts auth login --provider deveco`."
  }
  if (testCase.requires.includes("deveco-provider") && !env.auth.hasDevecoOAuth) {
    return "DevEco provider cannot be injected without a DevEco OAuth credential"
  }
  return undefined
}

async function runCase(testCase: LiveTestCase, env: Awaited<ReturnType<typeof collectEnvironment>>): Promise<ExecutedCase> {
  const start = Date.now()
  const reason = skipReason(testCase, env)
  if (reason) {
    return {
      case: testCase,
      status: "skipped",
      durationMs: duration(start),
      skipReason: reason,
      artifacts: {},
    }
  }

  const ctx = makeContext()
  const artifacts: Record<string, string> = {}
  const originalWriteArtifact = ctx.writeArtifact
  ctx.writeArtifact = async (caseID, filename, content) => {
    const file = await originalWriteArtifact(caseID, filename, content)
    artifacts[filename] = file
    return file
  }

  try {
    const result = await Promise.race([
      testCase.run(ctx),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out after ${testCase.timeoutMs}ms`)), testCase.timeoutMs),
      ),
    ])
    return {
      case: testCase,
      status: "passed",
      durationMs: duration(start),
      result,
      artifacts,
    }
  } catch (error) {
    return {
      case: testCase,
      status: "failed",
      durationMs: duration(start),
      error: error instanceof Error ? error.stack || error.message : String(error),
      artifacts,
    }
  }
}

function printList(selected: LiveTestCase[]) {
  console.log("Live E2E cases")
  for (const testCase of selected) {
    console.log(`${testCase.id.padEnd(20)} ${testCase.category.padEnd(8)} ${testCase.priority.padEnd(3)} ${testCase.title}`)
  }
}

function printSummary(report: SuiteReport) {
  console.log("")
  console.log("Live E2E Summary")
  console.log("")
  console.log(`Total:   ${report.summary.total}`)
  console.log(`Passed:  ${report.summary.passed}`)
  console.log(`Failed:  ${report.summary.failed}`)
  console.log(`Skipped: ${report.summary.skipped}`)
  console.log(`Duration: ${(report.summary.durationMs / 1000).toFixed(1)}s`)
  console.log("")
  for (const item of report.cases) {
    const status = item.status.toUpperCase().padEnd(7)
    const time = `${(item.durationMs / 1000).toFixed(1)}s`.padStart(7)
    console.log(`[${status}] ${item.case.id.padEnd(20)} ${time}  ${item.case.title}`)
    if (item.status === "failed" && item.error) console.log(`          ${item.error.split("\n")[0]}`)
    if (item.status === "skipped" && item.skipReason) console.log(`          ${item.skipReason}`)
  }
  console.log("")
  console.log(`Report: ${latestReportDir}/index.html`)
}

async function main() {
  const args = parseArgs(Bun.argv.slice(2))
  let selected = cases
  if (args.caseID) selected = selected.filter((testCase) => testCase.id === args.caseID)
  if (args.category) selected = selected.filter((testCase) => testCase.category === args.category)

  if (selected.length === 0) {
    console.error("No live e2e cases matched the provided filters")
    process.exit(1)
  }
  if (args.list) {
    printList(selected)
    return
  }

  await resetReportDir()
  const suiteStart = Date.now()
  const startedAt = new Date().toISOString()
  const environment = await collectEnvironment()
  const results: ExecutedCase[] = []

  for (const testCase of selected) {
    console.log(`Running ${testCase.id}: ${testCase.title}`)
    results.push(await runCase(testCase, environment))
  }

  const finishedAt = new Date().toISOString()
  const report: SuiteReport = {
    summary: {
      total: results.length,
      passed: results.filter((item) => item.status === "passed").length,
      failed: results.filter((item) => item.status === "failed").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      durationMs: duration(suiteStart),
      startedAt,
      finishedAt,
    },
    cases: results,
    environment,
  }

  await writeReports(report, latestReportDir)
  printSummary(report)

  if (report.summary.failed > 0) process.exit(1)
}

await main()
