import { describe, expect, test } from "bun:test"
import { readSource, fileExists } from "../lib/source-reader"

describe("pty/index.ts DEVECO_TERMINAL regression guard", () => {
  test("pty/index.ts source file exists", () => {
    expect(fileExists("packages/opencode/src/pty/index.ts")).toBe(true)
  })

  test("sets DEVECO_TERMINAL env var in spawned shell sessions", () => {
    const source = readSource("packages/opencode/src/pty/index.ts")
    expect(source).toContain("DEVECO_TERMINAL")
  })
})

describe("file/watcher.ts DEVECO watcher flags regression guard", () => {
  test("watcher.ts source file exists", () => {
    expect(fileExists("packages/opencode/src/file/watcher.ts")).toBe(true)
  })

  test("references DEVECO_LIBC for platform detection", () => {
    const source = readSource("packages/opencode/src/file/watcher.ts")
    expect(source).toContain("DEVECO_LIBC")
  })

  test("references DEVECO_EXPERIMENTAL_FILEWATCHER flag", () => {
    const source = readSource("packages/opencode/src/file/watcher.ts")
    expect(source).toContain("DEVECO_EXPERIMENTAL_FILEWATCHER")
  })

  test("references DEVECO_EXPERIMENTAL_DISABLE_FILEWATCHER flag", () => {
    const source = readSource("packages/opencode/src/file/watcher.ts")
    expect(source).toContain("DEVECO_EXPERIMENTAL_DISABLE_FILEWATCHER")
  })
})
