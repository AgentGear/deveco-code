import fs from "node:fs/promises"
import path from "node:path"
import type { SuiteReport } from "./types"

function escapeHtml(input: unknown) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function statusIcon(status: string) {
  if (status === "passed") return "PASS"
  if (status === "failed") return "FAIL"
  return "SKIP"
}

export async function writeReports(report: SuiteReport, reportDir: string) {
  await fs.mkdir(reportDir, { recursive: true })
  await fs.writeFile(path.join(reportDir, "summary.json"), JSON.stringify(report, null, 2))
  await fs.writeFile(path.join(reportDir, "summary.md"), markdown(report))
  await fs.writeFile(path.join(reportDir, "index.html"), html(report, reportDir))
}

function markdown(report: SuiteReport) {
  const lines = [
    "# Live E2E Report",
    "",
    `Started: ${report.summary.startedAt}`,
    `Finished: ${report.summary.finishedAt}`,
    `Duration: ${(report.summary.durationMs / 1000).toFixed(1)}s`,
    "",
    `Total: ${report.summary.total}`,
    `Passed: ${report.summary.passed}`,
    `Failed: ${report.summary.failed}`,
    `Skipped: ${report.summary.skipped}`,
    "",
    "| Status | ID | Title | Duration |",
    "|---|---|---|---|",
    ...report.cases.map(
      (item) =>
        `| ${statusIcon(item.status)} | ${item.case.id} | ${item.case.title} | ${(item.durationMs / 1000).toFixed(1)}s |`,
    ),
    "",
  ]
  return lines.join("\n")
}

function html(report: SuiteReport, reportDir: string) {
  const caseCards = report.cases
    .map((item) => {
      const artifacts = Object.entries(item.artifacts)
        .map(([name, file]) => `<li><a href="${escapeHtml(path.relative(reportDir, file))}">${escapeHtml(name)}</a></li>`)
        .join("")

      return `
        <section class="case ${item.status}">
          <h2>${statusIcon(item.status)} ${escapeHtml(item.case.id)} - ${escapeHtml(item.case.title)}</h2>
          <p>${escapeHtml(item.case.description)}</p>
          <dl>
            <dt>Category</dt><dd>${escapeHtml(item.case.category)}</dd>
            <dt>Priority</dt><dd>${escapeHtml(item.case.priority)}</dd>
            <dt>Duration</dt><dd>${(item.durationMs / 1000).toFixed(1)}s</dd>
            <dt>Code</dt><dd><code>${escapeHtml(item.case.code)}</code></dd>
            <dt>Cleanup</dt><dd>${escapeHtml(item.case.cleanup)}</dd>
          </dl>
          ${
            item.error
              ? `<p class="error"><strong>Error:</strong> ${escapeHtml(item.error)}</p>`
              : item.skipReason
                ? `<p><strong>Skip reason:</strong> ${escapeHtml(item.skipReason)}</p>`
                : ""
          }
          <details>
            <summary>Steps and expected result</summary>
            <h3>Steps</h3>
            <ol>${item.case.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
            <h3>Expected</h3>
            <ol>${item.case.expected.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
          </details>
          <details>
            <summary>Messages</summary>
            <h3>Sent</h3>
            <pre>${escapeHtml(item.result?.sentMessage ?? "(none)")}</pre>
            <h3>Received</h3>
            <pre>${escapeHtml(item.result?.receivedText ?? "(none)")}</pre>
            <h3>Session ID</h3>
            <pre>${escapeHtml(item.result?.sessionID ?? "(not found)")}</pre>
          </details>
          <details>
            <summary>Artifacts</summary>
            <ul>${artifacts || "<li>No artifacts</li>"}</ul>
            <h3>stdout</h3>
            <pre>${escapeHtml(item.result?.stdout ?? "")}</pre>
            <h3>stderr</h3>
            <pre>${escapeHtml(item.result?.stderr ?? "")}</pre>
          </details>
        </section>
      `
    })
    .join("\n")

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>DevEco Live E2E Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #1f2937; }
    header { border-bottom: 1px solid #d1d5db; margin-bottom: 24px; padding-bottom: 16px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 12px; max-width: 760px; }
    .metric { border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; }
    .metric strong { display: block; font-size: 24px; }
    .case { border: 1px solid #d1d5db; border-left-width: 6px; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .case.passed { border-left-color: #15803d; }
    .case.failed { border-left-color: #b91c1c; }
    .case.skipped { border-left-color: #a16207; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 6px 12px; }
    dt { font-weight: 700; }
    pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow: auto; }
    details { margin-top: 12px; }
    summary { cursor: pointer; font-weight: 700; }
    .error { color: #b91c1c; }
  </style>
</head>
<body>
  <header>
    <h1>DevEco Live E2E Report</h1>
    <p>${escapeHtml(report.summary.startedAt)} - ${escapeHtml(report.summary.finishedAt)}</p>
    <div class="summary">
      <div class="metric"><span>Total</span><strong>${report.summary.total}</strong></div>
      <div class="metric"><span>Passed</span><strong>${report.summary.passed}</strong></div>
      <div class="metric"><span>Failed</span><strong>${report.summary.failed}</strong></div>
      <div class="metric"><span>Skipped</span><strong>${report.summary.skipped}</strong></div>
    </div>
  </header>
  ${caseCards}
</body>
</html>`
}
