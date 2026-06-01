import { afterEach, describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import path from "path"
import fs from "fs/promises"
import { SpecWriteTool } from "../../src/tool/spec"
import { Tool } from "@/tool/tool"
import { SessionID, MessageID } from "../../src/session/schema"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "@/tool/truncate"
import { LSP } from "@/lsp/lsp"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { Bus } from "../../src/bus"
import { Format } from "../../src/format"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { testEffect } from "../lib/effect"
import { TestInstance, disposeAllInstances } from "../fixture/fixture"

const ctx = {
  sessionID: SessionID.make("ses_test-spec-write"),
  messageID: MessageID.make("msg_test-spec"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

afterEach(async () => {
  await disposeAllInstances()
})

const it = testEffect(
  Layer.mergeAll(
    LSP.defaultLayer,
    AppFileSystem.defaultLayer,
    Bus.layer,
    Format.defaultLayer,
    CrossSpawnSpawner.defaultLayer,
    Truncate.defaultLayer,
    Agent.defaultLayer,
  ),
)

const init = Effect.fn("SpecWriteToolTest.init")(function* () {
  const info = yield* SpecWriteTool
  return yield* info.init()
})

const run = Effect.fn("SpecWriteToolTest.run")(function* (
  args: Tool.InferParameters<typeof SpecWriteTool>,
  next: Tool.Context = ctx,
) {
  const tool = yield* init()
  return yield* tool.execute(args, next).pipe(Effect.timeout("10 seconds"))
})

describe("tool.spec_write", () => {
  describe("new file creation", () => {
    it.instance("writes spec.md to target path", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const target = path.join(test.directory, "spec", "default", "spec.md")
        const result = yield* run({ filePath: target, content: "# Feature Specification: Auth\n\n## Overview\n\noverview" })

        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("# Feature Specification: Auth\n\n## Overview\n\noverview")
        expect(result.title).toBe("Spec Artifact Written")
        expect(result.metadata.filepath).toBe(target)
        expect(result.output).toContain("Wrote file successfully.")
      }),
    )

    it.instance("writes plan.md to target path", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const target = path.join(test.directory, "spec", "default", "plan.md")
        const result = yield* run({ filePath: target, content: "# Implementation Plan: Auth\n\n## Summary\n\nsummary" })

        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("# Implementation Plan: Auth\n\n## Summary\n\nsummary")
        expect(result.title).toBe("Spec Artifact Written")
      }),
    )

    it.instance("writes tasks.md to target path", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const target = path.join(test.directory, "spec", "default", "tasks.md")
        const result = yield* run({
          filePath: target,
          content: "# Tasks: Auth\n\n## Format\n\nformat\n\n## Path Conventions\n\npaths",
        })

        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("# Tasks: Auth\n\n## Format\n\nformat\n\n## Path Conventions\n\npaths")
        expect(result.title).toBe("Spec Artifact Written")
      }),
    )

    it.instance("creates parent directories if needed", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const target = path.join(test.directory, "spec", "default", "spec.md")
        yield* run({ filePath: target, content: "test" })

        const stats = yield* Effect.promise(() => fs.stat(target))
        expect(stats.isFile()).toBe(true)
      }),
    )

    it.instance("resolves relative paths against instance directory", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const result = yield* run({ filePath: "spec/auth/spec.md", content: "relative path content" })

        const target = path.join(test.directory, "spec", "auth", "spec.md")
        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("relative path content")
        expect(result.metadata.filepath).toBe(target)
      }),
    )
  })

  describe("document validation integration", () => {
    it.instance("returns validation errors for invalid spec", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const target = path.join(test.directory, "spec", "default", "spec.md")
        const result = yield* run({
          filePath: target,
          content: "# Feature Specification: Auth\n\n## Overview\n\noverview",
        })

        expect(result.output).toContain("Document Section Validation")
        expect(result.output).toContain("Missing required sections")
      }),
    )

    it.instance("returns no validation errors for valid spec", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const target = path.join(test.directory, "spec", "default", "spec.md")
        const content = `# Feature Specification: Auth

## Overview

overview

## User Scenarios & Testing

story

## Requirements

reqs

## Success Criteria

criteria

## Assumptions

assumptions

## Open Questions

questions
`
        const result = yield* run({ filePath: target, content })

        expect(result.output).not.toContain("Document Section Validation")
        expect(result.output).toContain("Wrote file successfully.")
      }),
    )

    it.instance("returns validation errors for invalid plan", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const target = path.join(test.directory, "spec", "default", "plan.md")
        const result = yield* run({
          filePath: target,
          content: "# Implementation Plan: Auth\n\n## Summary\n\nsummary",
        })

        expect(result.output).toContain("Document Section Validation")
        expect(result.output).toContain("Missing required sections")
      }),
    )

    it.instance("returns validation errors for invalid tasks", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const target = path.join(test.directory, "spec", "default", "tasks.md")
        const result = yield* run({
          filePath: target,
          content: "# Tasks: Auth\n\n## Format\n\nformat",
        })

        expect(result.output).toContain("Document Section Validation")
        expect(result.output).toContain("Missing required sections")
      }),
    )
  })

  describe("output display", () => {
    it.instance("returns relative path in output", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const target = path.join(test.directory, "spec", "default", "spec.md")
        const result = yield* run({ filePath: target, content: "# Feature Specification: Auth\n\n## Overview\n\noverview" })

        expect(result.metadata.filepath).toBe(target)
      }),
    )
  })
})
