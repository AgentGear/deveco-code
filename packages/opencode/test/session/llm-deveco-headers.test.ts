import { describe, expect, test } from "bun:test"
import { readSource } from "../lib/source-reader"

describe("LLM deveco proxy headers regression guard", () => {
  const DEVECO_HEADERS = ["x-deveco-project", "x-deveco-session", "x-deveco-request", "x-deveco-client"]

  for (const header of DEVECO_HEADERS) {
    test(`contains "${header}" proxy header injection`, () => {
      const llmSource = readSource("packages/opencode/src/session/llm.ts")
      const requestSource = readSource("packages/opencode/src/session/llm/request.ts")
      const source = llmSource.includes(header) ? llmSource : requestSource
      expect(source).toContain(header)
    })
  }

  test("injects User-Agent with deveco brand", () => {
    const llmSource = readSource("packages/opencode/src/session/llm.ts")
    const requestSource = readSource("packages/opencode/src/session/llm/request.ts")
    const source = llmSource.match(/User-Agent.*deveco/) ? llmSource : requestSource
    expect(source).toMatch(/User-Agent.*deveco|USER_AGENT.*deveco/)
  })

  test("detects deveco provider prefix for project ID routing", () => {
    const llmSource = readSource("packages/opencode/src/session/llm.ts")
    const requestSource = readSource("packages/opencode/src/session/llm/request.ts")
    const source = llmSource.includes("deveco") ? llmSource : requestSource
    expect(source).toMatch(/providerID\.startsWith\("deveco"\)/)
  })
})
