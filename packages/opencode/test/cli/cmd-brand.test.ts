import { describe, expect, test } from "bun:test"
import { readSource } from "../lib/source-reader"

describe("run.ts deveco CLI describe regression guard", () => {
  const source = readSource("packages/opencode/src/cli/cmd/run.ts")

  test.skip("describe says 'run deveco with a message' (A5)", () => {
    expect(source).toMatch(/run deveco with a message/)
  })

  test.skip("describe says 'attach to a running deveco server' (A6)", () => {
    expect(source).toMatch(/attach to a running deveco server/)
  })

  test.skip("username defaults to 'deveco' not 'opencode' (A7)", () => {
    expect(source).toMatch(/defaults to DEVECO_SERVER_USERNAME or 'deveco'/)
  })
})

describe("web.ts deveco CLI describe regression guard", () => {
  const source = readSource("packages/opencode/src/cli/cmd/web.ts")

  test.skip("describe says 'start deveco server' (A10)", () => {
    expect(source).toMatch(/start deveco server/)
  })
})

describe("mcp.ts deveco CLI text regression guard", () => {
  const source = readSource("packages/opencode/src/cli/cmd/mcp.ts")

  test.skip("prompts say 'deveco mcp add' not 'opencode mcp add' (A11)", () => {
    expect(source).toMatch(/Add servers with: deveco mcp add/)
  })

  test.skip("example placeholder uses 'deveco' not 'opencode' (A12)", () => {
    expect(source).toMatch(/e\.g\.,\s*deveco x @/)
  })

  test("references DEVECO_SERVER_PASSWORD for MCP auth (fixed)", () => {
    expect(source).toContain("DEVECO_SERVER_PASSWORD")
  })
})

describe("pr.ts deveco CLI text regression guard", () => {
  const source = readSource("packages/opencode/src/cli/cmd/pr.ts")

  test.skip("says 'Found deveco session' not 'opencode session' (A13)", () => {
    expect(source).toMatch(/Found deveco session/)
  })

  test.skip("says 'Starting deveco...' not 'Starting opencode...' (A14)", () => {
    expect(source).toMatch(/Starting deveco\.\.\./)
  })
})

describe("splash.ts deveco CLI text regression guard", () => {
  const source = readSource("packages/opencode/src/cli/cmd/run/splash.ts")

  test.skip("splash command uses 'deveco run' not 'opencode run' (A15)", () => {
    expect(source).toMatch(/deveco run -i -s/)
  })
})

describe("attention.ts deveco TUI title regression guard", () => {
  const source = readSource("packages/opencode/src/cli/cmd/tui/attention.ts")

  test.skip("DEFAULT_TITLE is 'deveco' not 'opencode' (A16)", () => {
    expect(source).toMatch(/DEFAULT_TITLE\s*=\s*"deveco"/)
  })

  test.skip("DEFAULT_PACK_ID uses 'deveco' not 'opencode' (A16)", () => {
    expect(source).toMatch(/DEFAULT_PACK_ID\s*=\s*"deveco\.default"/)
  })

  test.skip("name uses 'DevEco' not 'OpenCode' (A16)", () => {
    expect(source).toMatch(/name:\s*"DevEco Default"/)
  })
})

describe("auth.ts deveco default username regression guard", () => {
  const source = readSource("packages/opencode/src/server/auth.ts")

  test.skip("default username is 'deveco' not 'opencode'", () => {
    expect(source).toMatch(/"deveco"/)
    expect(source).not.toMatch(/Flag\.DEVECO_SERVER_USERNAME\s*\?\?\s*"opencode"/)
  })
})

describe("serve.ts deveco branding regression guard (fixed items)", () => {
  const source = readSource("packages/opencode/src/cli/cmd/serve.ts")

  test("describe says 'starts a headless deveco server'", () => {
    expect(source).toMatch(/starts a headless deveco server/)
  })

  test("startup log says 'deveco server'", () => {
    expect(source).toMatch(/deveco server/)
  })

  test("references DEVECO_SERVER_PASSWORD", () => {
    expect(source).toContain("DEVECO_SERVER_PASSWORD")
  })
})
