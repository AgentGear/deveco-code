import { describe, expect, test } from "bun:test"
import { readSource } from "../lib/source-reader"

describe("acp/agent.ts DevEco login regression guard", () => {
  test("contains DevEco login option for ACP authentication", () => {
    const source = readSource("packages/opencode/src/acp/agent.ts")
    expect(source).toMatch(/Login with DevEco Code/)
  })

  test("contains deveco-login tool ID", () => {
    const source = readSource("packages/opencode/src/acp/agent.ts")
    expect(source).toMatch(/deveco-login/)
  })

  test("references deveco auth login command", () => {
    const source = readSource("packages/opencode/src/acp/agent.ts")
    expect(source).toMatch(/deveco auth login/)
  })

  test("includes deveco command reference in login flow", () => {
    const source = readSource("packages/opencode/src/acp/agent.ts")
    expect(source).toContain("deveco")
  })
})
