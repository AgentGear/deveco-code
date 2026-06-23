import { describe, expect, test } from "bun:test"
import { readSource } from "../lib/source-reader"

describe("workspace-routing.ts DEVECO_WORKSPACE_ID regression guard", () => {
  test("references DEVECO_WORKSPACE_ID for workspace placement", () => {
    const source = readSource("packages/opencode/src/server/routes/instance/httpapi/middleware/workspace-routing.ts")
    expect(source).toContain("DEVECO_WORKSPACE_ID")
  })

  test("reads x-deveco-directory header for directory routing", () => {
    const source = readSource("packages/opencode/src/server/routes/instance/httpapi/middleware/workspace-routing.ts")
    expect(source).toContain("x-deveco-directory")
  })
})

describe("fence.ts DEVECO_WORKSPACE_ID regression guard", () => {
  test("gates middleware on DEVECO_WORKSPACE_ID presence", () => {
    const source = readSource("packages/opencode/src/server/routes/instance/httpapi/middleware/fence.ts")
    expect(source).toContain("DEVECO_WORKSPACE_ID")
  })
})

describe("Flag.DEVECO_WORKSPACE_ID in flag.ts", () => {
  test("flag.ts exports DEVECO_WORKSPACE_ID", () => {
    const source = readSource("packages/core/src/flag/flag.ts")
    expect(source).toMatch(/DEVECO_WORKSPACE_ID:\s*process\.env/)
  })
})
