import { describe, expect, test } from "bun:test"
import { readSource } from "../lib/source-reader"

describe("index.ts deveco CLI branding regression guard", () => {
  test("scriptName is deveco (not opencode)", () => {
    const source = readSource("packages/opencode/src/index.ts")
    expect(source).toMatch(/scriptName\("deveco"\)/)
  })

  test("sets DEVECO=1 process identity env var", () => {
    const source = readSource("packages/opencode/src/index.ts")
    expect(source).toMatch(/process\.env\.DEVECO\s*=\s*"1"/)
  })

  test("sets DEVECO_PID env var", () => {
    const source = readSource("packages/opencode/src/index.ts")
    expect(source).toMatch(/DEVECO_PID/)
  })

  test("sets DEVECO_PURE env var for pure mode", () => {
    const source = readSource("packages/opencode/src/index.ts")
    expect(source).toMatch(/DEVECO_PURE/)
  })

  test("references DEVECO_SKIP_AGREEMENT flag", () => {
    const source = readSource("packages/opencode/src/index.ts")
    expect(source).toMatch(/DEVECO_SKIP_AGREEMENT|skip-agreement/)
  })

  test("uses deveco branding in log identity", () => {
    const source = readSource("packages/opencode/src/index.ts")
    expect(source).toMatch(/"deveco"/)
  })
})
