import { describe, expect, test } from "bun:test"
import { readSource } from "../lib/source-reader"

describe("github.ts DevEco CI/CD naming regression guard", () => {
  test("uses deveco.yml as workflow file path", () => {
    const source = readSource("packages/opencode/src/cli/cmd/github.ts")
    expect(source).toContain(".github/workflows/deveco.yml")
  })

  test("uses deveco/ prefix for branch naming convention", () => {
    const source = readSource("packages/opencode/src/cli/cmd/github.ts")
    expect(source).toMatch(/deveco\/.*type/)
  })
})
