import { describe, expect, test } from "bun:test"
import { readSource } from "../lib/source-reader"

const KNOWN_OPENCODE_FLAG_FILES: Array<{ path: string; flag: string }> = [
  { path: "packages/opencode/src/cli/cmd/run.ts", flag: "OPENCODE_SERVER_PASSWORD" },
  { path: "packages/opencode/src/cli/cmd/web.ts", flag: "OPENCODE_SERVER_PASSWORD" },
  { path: "packages/opencode/src/cli/cmd/serve.ts", flag: "OPENCODE_SERVER_PASSWORD" },
  { path: "packages/opencode/src/server/routes/instance/httpapi/middleware/workspace-routing.ts", flag: "OPENCODE_WORKSPACE_ID" },
  { path: "packages/opencode/src/server/routes/instance/httpapi/middleware/fence.ts", flag: "OPENCODE_WORKSPACE_ID" },
  { path: "packages/opencode/src/cli/cmd/tui/plugin/internal.ts", flag: "OPENCODE_EXPERIMENTAL_SESSION_SWITCHER" },
]

describe("OPENCODE_* flag residual regression guard (P0 Bug #1)", () => {
  for (const { path, flag } of KNOWN_OPENCODE_FLAG_FILES) {
    test(`Flag.${flag} in ${path} should be DEVECO_* equivalent`, () => {
      const source = readSource(path)
      expect(source).not.toContain(`Flag.${flag}`)
      const devecoFlag = flag.replace("OPENCODE_", "DEVECO_")
      expect(source).toContain(`Flag.${devecoFlag}`)
    })
  }
})

describe("core/flag.ts has no OPENCODE_ env var exports (positive check)", () => {
  const source = readSource("packages/core/src/flag/flag.ts")

  test("flag.ts exports DEVECO_SERVER_PASSWORD (not OPENCODE_SERVER_PASSWORD)", () => {
    expect(source).toMatch(/DEVECO_SERVER_PASSWORD:\s*process\.env/)
    expect(source).not.toMatch(/OPENCODE_SERVER_PASSWORD:\s*process\.env/)
  })

  test("flag.ts exports DEVECO_SERVER_USERNAME (not OPENCODE_SERVER_USERNAME)", () => {
    expect(source).toMatch(/DEVECO_SERVER_USERNAME:\s*process\.env/)
    expect(source).not.toMatch(/OPENCODE_SERVER_USERNAME:\s*process\.env/)
  })

  test("flag.ts exports DEVECO_WORKSPACE_ID (not OPENCODE_WORKSPACE_ID)", () => {
    expect(source).toMatch(/DEVECO_WORKSPACE_ID:\s*process\.env/)
    expect(source).not.toMatch(/OPENCODE_WORKSPACE_ID:\s*process\.env/)
  })
})

describe("runtime-flags.ts uses DEVECO_* prefix (not OPENCODE_*)", () => {
  const source = readSource("packages/opencode/src/effect/runtime-flags.ts")

  test("runtime-flags references DEVECO_ prefix", () => {
    expect(source).toMatch(/DEVECO_/)
  })
})
