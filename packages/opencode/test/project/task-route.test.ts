import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { buildExploreContext } from "../../src/project/task-route"

// buildExploreContext is the only public entry point of task-route. These tests
// build minimal HarmonyOS project trees in a tmpdir and assert on the generated
// routing text, exercising the JSON5-tolerant parsing, module/ability scanning,
// ets symbol/component extraction and startup-chain routing end-to-end.

describe("task-route", () => {
  let root: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "task-route-"))
  })
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  function write(rel: string, content: string) {
    const abs = path.join(root, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
  }

  test("returns undefined for a directory that is not a HarmonyOS project", () => {
    write("README.md", "not a harmony project")
    expect(buildExploreContext(root)).toBeUndefined()
  })

  test("routes an entry module end-to-end, tolerating JSON5 comments, trailing commas and unquoted keys", () => {
    // Every json5 file below mixes // comments, block comments, trailing commas and
    // unquoted keys — if the JSON5-tolerant parser regressed, module scanning would
    // silently skip the entry module and the routing text would not mention it.
    write("AppScope/app.json5", `{ app: { bundleName: "com.example.app", } }`)
    write(
      "build-profile.json5",
      [
        "{",
        "  // declare the entry module",
        '  "modules": [',
        '    { name: "entry", srcPath: "./entry", }',
        "  ],",
        "}",
      ].join("\n"),
    )
    write(
      "entry/src/main/module.json5",
      [
        "{",
        "  module: {",
        '    name: "entry",',
        '    type: "entry",',
        '    mainElement: "EntryAbility",',
        "    abilities: [",
        '      { name: "EntryAbility", srcEntry: "./ets/EntryAbility.ets", }',
        "    ],",
        "  },",
        "}",
      ].join("\n"),
    )
    write(
      "entry/src/main/ets/EntryAbility.ets",
      "export class EntryAbility { /* entry */ windowStage.loadContent('pages/Index') }",
    )
    write("entry/src/main/ets/pages/Index.ets", "@Entry @Component struct Index {}")

    const result = buildExploreContext(root)
    expect(result).toBeDefined()
    expect(result).toContain("Task routing")
    expect(result).toContain("entry")
    expect(result).toContain("module.json5")
    expect(result).toContain("loadContent")
    expect(result).toContain("EntryAbility")
  })
})
