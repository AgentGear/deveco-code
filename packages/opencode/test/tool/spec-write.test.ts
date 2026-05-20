import { afterEach, describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import path from "path"
import fs from "fs/promises"
import { SpecWriteTool } from "../../src/tool/spec"
import { Tool } from "@/tool/tool"
import { SessionID, MessageID } from "../../src/session/schema"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "@/tool/truncate"
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
    it.instance("writes spec.md to default directory", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const result = yield* run({ file: "spec.md", content: "# Feature Specification: Auth\n\n## Overview\n\noverview" })

        const target = path.join(test.directory, ".specs", "default", "spec.md")
        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("# Feature Specification: Auth\n\n## Overview\n\noverview")
        expect(result.title).toBe("Spec Artifact Written")
        expect(result.metadata.path).toBe(target)
        expect(result.output).toContain("Written to")
      }),
    )

    it.instance("writes plan.md to default directory", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const result = yield* run({ file: "plan.md", content: "# Implementation Plan: Auth\n\n## Summary\n\nsummary" })

        const target = path.join(test.directory, ".specs", "default", "plan.md")
        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("# Implementation Plan: Auth\n\n## Summary\n\nsummary")
        expect(result.title).toBe("Spec Artifact Written")
      }),
    )

    it.instance("writes tasks.md to default directory", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const result = yield* run({
          file: "tasks.md",
          content: "# Tasks: Auth\n\n## Format\n\nformat\n\n## Path Conventions\n\npaths",
        })

        const target = path.join(test.directory, ".specs", "default", "tasks.md")
        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("# Tasks: Auth\n\n## Format\n\nformat\n\n## Path Conventions\n\npaths")
        expect(result.title).toBe("Spec Artifact Written")
      }),
    )

    it.instance("creates parent directories if needed", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        yield* run({ file: "spec.md", content: "test" })

        const target = path.join(test.directory, ".specs", "default", "spec.md")
        const stats = yield* Effect.promise(() => fs.stat(target))
        expect(stats.isFile()).toBe(true)
      }),
    )
  })

  describe("append mode", () => {
    it.instance("appends content when append is true", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        yield* run({ file: "spec.md", content: "first line\n" })
        yield* run({ file: "spec.md", content: "second line\n", append: true })

        const target = path.join(test.directory, ".specs", "default", "spec.md")
        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("first line\nsecond line\n")
      }),
    )

    it.instance("overwrites content when append is false", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        yield* run({ file: "spec.md", content: "old content" })
        yield* run({ file: "spec.md", content: "new content" })

        const target = path.join(test.directory, ".specs", "default", "spec.md")
        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("new content")
      }),
    )
  })

  describe("directory override", () => {
    it.instance("uses directory parameter when provided", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const result = yield* run({
          file: "spec.md",
          content: "custom dir content",
          directory: "custom/specs",
        })

        const target = path.join(test.directory, "custom", "specs", "spec.md")
        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("custom dir content")
        expect(result.metadata.path).toBe(target)
      }),
    )
  })

  describe("feature.json resolution", () => {
    it.instance("reads feature_directory from feature.json", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const specsDir = path.join(test.directory, ".specs")
        yield* Effect.promise(() => fs.mkdir(specsDir, { recursive: true }))
        yield* Effect.promise(() =>
          fs.writeFile(
            path.join(specsDir, "feature.json"),
            JSON.stringify({ feature_directory: "features/auth" }),
            "utf-8",
          ),
        )

        yield* run({ file: "spec.md", content: "from feature dir" })

        const target = path.join(test.directory, "features", "auth", "spec.md")
        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("from feature dir")
      }),
    )

    it.instance("reads default_feature_dir from feature.json", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const specsDir = path.join(test.directory, ".specs")
        yield* Effect.promise(() => fs.mkdir(specsDir, { recursive: true }))
        yield* Effect.promise(() =>
          fs.writeFile(
            path.join(specsDir, "feature.json"),
            JSON.stringify({ default_feature_dir: "features/default" }),
            "utf-8",
          ),
        )

        yield* run({ file: "spec.md", content: "from default feature dir" })

        const target = path.join(test.directory, "features", "default", "spec.md")
        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("from default feature dir")
      }),
    )

    it.instance("prefers feature_directory over default_feature_dir", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const specsDir = path.join(test.directory, ".specs")
        yield* Effect.promise(() => fs.mkdir(specsDir, { recursive: true }))
        yield* Effect.promise(() =>
          fs.writeFile(
            path.join(specsDir, "feature.json"),
            JSON.stringify({ feature_directory: "features/a", default_feature_dir: "features/b" }),
            "utf-8",
          ),
        )

        yield* run({ file: "spec.md", content: "preferred" })

        const target = path.join(test.directory, "features", "a", "spec.md")
        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("preferred")
      }),
    )

    it.instance("falls back to default when feature.json is malformed", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const specsDir = path.join(test.directory, ".specs")
        yield* Effect.promise(() => fs.mkdir(specsDir, { recursive: true }))
        yield* Effect.promise(() => fs.writeFile(path.join(specsDir, "feature.json"), "not json", "utf-8"))

        yield* run({ file: "spec.md", content: "fallback content" })

        const target = path.join(test.directory, ".specs", "default", "spec.md")
        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("fallback content")
      }),
    )

    it.instance("falls back to default when feature.json has empty dir", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const specsDir = path.join(test.directory, ".specs")
        yield* Effect.promise(() => fs.mkdir(specsDir, { recursive: true }))
        yield* Effect.promise(() =>
          fs.writeFile(
            path.join(specsDir, "feature.json"),
            JSON.stringify({ feature_directory: "" }),
            "utf-8",
          ),
        )

        yield* run({ file: "spec.md", content: "empty fallback" })

        const target = path.join(test.directory, ".specs", "default", "spec.md")
        const content = yield* Effect.promise(() => fs.readFile(target, "utf-8"))
        expect(content).toBe("empty fallback")
      }),
    )
  })

  describe("document validation integration", () => {
    it.instance("returns validation errors for invalid spec", () =>
      Effect.gen(function* () {
        const result = yield* run({
          file: "spec.md",
          content: "# Feature Specification: Auth\n\n## Overview\n\noverview",
        })

        expect(result.output).toContain("Document Section Validation")
        expect(result.output).toContain("Missing required sections")
      }),
    )

    it.instance("returns no validation errors for valid spec", () =>
      Effect.gen(function* () {
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
        const result = yield* run({ file: "spec.md", content })

        expect(result.output).not.toContain("Document Section Validation")
        expect(result.output).toContain("Written to")
      }),
    )

    it.instance("returns validation errors for invalid plan", () =>
      Effect.gen(function* () {
        const result = yield* run({
          file: "plan.md",
          content: "# Implementation Plan: Auth\n\n## Summary\n\nsummary",
        })

        expect(result.output).toContain("Document Section Validation")
        expect(result.output).toContain("Missing required sections")
      }),
    )

    it.instance("returns validation errors for invalid tasks", () =>
      Effect.gen(function* () {
        const result = yield* run({
          file: "tasks.md",
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
        const result = yield* run({ file: "spec.md", content: "# Feature Specification: Auth\n\n## Overview\n\noverview" })

        expect(result.output).toContain(path.join(".specs", "default", "spec.md"))
      }),
    )
  })
})
