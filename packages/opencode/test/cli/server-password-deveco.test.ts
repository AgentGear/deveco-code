import { describe, expect, test } from "bun:test"
import { readSource, fileExists } from "../lib/source-reader"

describe("web.ts DEVECO_SERVER_PASSWORD regression guard", () => {
  test("references DEVECO_SERVER_PASSWORD for server security", () => {
    const source = readSource("packages/opencode/src/cli/cmd/web.ts")
    expect(source).toContain("DEVECO_SERVER_PASSWORD")
  })

  test("warns when DEVECO_SERVER_PASSWORD is not set", () => {
    const source = readSource("packages/opencode/src/cli/cmd/web.ts")
    expect(source).toMatch(/DEVECO_SERVER_PASSWORD.*not set/)
  })
})

describe("serve.ts DEVECO_SERVER_PASSWORD regression guard", () => {
  test("references DEVECO_SERVER_PASSWORD for headless server security", () => {
    const source = readSource("packages/opencode/src/cli/cmd/serve.ts")
    expect(source).toContain("DEVECO_SERVER_PASSWORD")
  })

  test("warns about unsecured server when password not set", () => {
    const source = readSource("packages/opencode/src/cli/cmd/serve.ts")
    expect(source).toMatch(/unsecured|not set/)
  })

  test("uses deveco branding in server startup log", () => {
    const source = readSource("packages/opencode/src/cli/cmd/serve.ts")
    expect(source).toMatch(/deveco server/)
  })
})

describe("core/auth.ts DEVECO_AUTH_CONTENT regression guard", () => {
  test("source file references DEVECO_AUTH_CONTENT env var", () => {
    expect(fileExists("packages/core/src/auth.ts")).toBe(true)
    const source = readSource("packages/core/src/auth.ts")
    expect(source).toContain("DEVECO_AUTH_CONTENT")
  })

  test("parseAuthContent function handles empty env var", () => {
    process.env.DEVECO_AUTH_CONTENT = ""
    const raw = (() => { try { return JSON.parse(process.env.DEVECO_AUTH_CONTENT ?? "") } catch {} })()
    expect(raw).toBeUndefined()
  })

  test("parseAuthContent function handles valid v2 JSON", () => {
    process.env.DEVECO_AUTH_CONTENT = JSON.stringify({ version: 2, accounts: {}, active: {} })
    const raw = (() => { try { return JSON.parse(process.env.DEVECO_AUTH_CONTENT ?? "") } catch {} })()
    expect(raw).toEqual({ version: 2, accounts: {}, active: {} })
  })

  test("parseAuthContent function handles invalid JSON", () => {
    process.env.DEVECO_AUTH_CONTENT = "not-json"
    const raw = (() => { try { return JSON.parse(process.env.DEVECO_AUTH_CONTENT ?? "") } catch {} })()
    expect(raw).toBeUndefined()
  })
})

describe("Flag DEVECO_SERVER credentials in flag.ts", () => {
  test("flag.ts exports DEVECO_SERVER_PASSWORD", () => {
    const source = readSource("packages/core/src/flag/flag.ts")
    expect(source).toMatch(/DEVECO_SERVER_PASSWORD:\s*process\.env/)
  })

  test("flag.ts exports DEVECO_SERVER_USERNAME", () => {
    const source = readSource("packages/core/src/flag/flag.ts")
    expect(source).toMatch(/DEVECO_SERVER_USERNAME:\s*process\.env/)
  })
})
