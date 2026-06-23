import { describe, expect, test } from "bun:test"
import { readSource, fileExists } from "../lib/source-reader"

describe("storage/db.ts deveco database naming regression guard", () => {
  test("db.ts source file exists", () => {
    expect(fileExists("packages/opencode/src/storage/db.ts")).toBe(true)
  })

  test("references deveco.db as default database name", () => {
    const source = readSource("packages/opencode/src/storage/db.ts")
    expect(source).toContain("deveco.db")
  })

  test("references Flag.DEVECO_DB for custom database path", () => {
    const source = readSource("packages/opencode/src/storage/db.ts")
    expect(source).toContain("DEVECO_DB")
  })

  test("references DEVECO_MIGRATIONS for bundled mode", () => {
    const source = readSource("packages/opencode/src/storage/db.ts")
    expect(source).toContain("DEVECO_MIGRATIONS")
  })

  test("uses channel-based db naming (deveco-${channel}.db)", () => {
    const source = readSource("packages/opencode/src/storage/db.ts")
    expect(source).toMatch(/deveco-\$\{?safe/)
  })
})

describe("Flag.DEVECO_DB regression guard", () => {
  test("flag.ts defines DEVECO_DB reading from process.env", () => {
    const source = readSource("packages/core/src/flag/flag.ts")
    expect(source).toContain("DEVECO_DB")
    expect(source).toMatch(/DEVECO_DB.*process\.env/)
  })
})
