import { describe, expect, test } from "bun:test"
import { readSource } from "../lib/source-reader"

describe("provider.ts HTTP header brand regression guard (D-class)", () => {
  const source = readSource("packages/opencode/src/provider/provider.ts")

  test.skip("X-Title headers use 'deveco' not 'opencode' (D1)", () => {
    expect(source).toMatch(/"X-Title":\s*"deveco"/)
  })

  test.skip("HTTP-Referer headers use 'https://deveco.ai/' not 'https://opencode.ai/' (D2)", () => {
    expect(source).toMatch(/"HTTP-Referer":\s*"https:\/\/deveco\.ai\/"/)
  })

  test.skip("User-Agent uses 'deveco' not 'opencode' (D3)", () => {
    expect(source).toMatch(/"User-Agent":\s*`deveco\/\$\{/)
  })
})

describe("mcp/index.ts client name brand regression guard (D7)", () => {
  const source = readSource("packages/opencode/src/mcp/index.ts")

  test.skip("MCP Client name is 'deveco' not 'opencode' (D7)", () => {
    expect(source).toMatch(/name:\s*"deveco"/)
    expect(source).not.toMatch(/name:\s*"opencode"/)
  })
})

describe("httpapi/api.ts identifier uses upstream protocol identifier", () => {
  const source = readSource("packages/opencode/src/server/routes/instance/httpapi/api.ts")

  test("HttpApi.make keeps upstream API identifier unchanged (not branded)", () => {
    expect(source).toMatch(/HttpApi\.make\("opencode/)
  })
})

describe("acp/agent.ts agentInfo brand regression guard (D10)", () => {
  const source = readSource("packages/opencode/src/acp/agent.ts")

  test("ACP login command uses 'deveco'", () => {
    expect(source).toMatch(/deveco auth login/)
  })

  test("ACP command is 'deveco'", () => {
    expect(source).toMatch(/command:\s*"deveco"/)
  })

  test("ACP login label says 'DevEco Code'", () => {
    expect(source).toMatch(/DevEco Code Login/)
  })

  test.skip("agentInfo name is 'DevEco' not 'OpenCode' (D10 residual)", () => {
    expect(source).toMatch(/name:\s*"DevEco"/)
    expect(source).not.toMatch(/name:\s*"OpenCode"/)
  })
})

describe("webfetch/websearch User-Agent brand regression guard (D4-D5)", () => {
  test.skip("webfetch User-Agent uses 'deveco' not 'opencode' (D5)", () => {
    const source = readSource("packages/opencode/src/tool/webfetch.ts")
    expect(source).toMatch(/"User-Agent":\s*"deveco"/)
  })

  test.skip("websearch User-Agent uses 'deveco' not 'opencode' (D4)", () => {
    const source = readSource("packages/opencode/src/tool/websearch.ts")
    expect(source).toMatch(/"User-Agent":\s*`deveco\/\$\{/)
  })
})

describe("installation/index.ts User-Agent brand regression guard (D6)", () => {
  test.skip("installation check UA uses 'deveco' not 'opencode' (D6)", () => {
    const source = readSource("packages/opencode/src/installation/index.ts")
    expect(source).toMatch(/deveco\/\$\{channel\}/)
  })
})

describe("public.ts HTTP title brand regression guard", () => {
  test.skip("public API HTML title uses 'deveco' not 'opencode'", () => {
    const source = readSource("packages/opencode/src/server/routes/instance/httpapi/public.ts")
    expect(source).toMatch(/title:\s*"deveco"/)
  })

  test.skip("public API description uses 'deveco' not 'opencode'", () => {
    const source = readSource("packages/opencode/src/server/routes/instance/httpapi/public.ts")
    expect(source).toMatch(/description:\s*"deveco api"/)
  })
})
