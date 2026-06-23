import { afterEach, describe, expect } from "bun:test"
import path from "path"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Auth } from "@/auth"
import { Agent } from "@/agent/agent"
import { Permission } from "@/permission"
import { ToolRegistry } from "@/tool/registry"
import { ProviderID, ModelID } from "@/provider/schema"
import { Plugin } from "@/plugin"
import { Question } from "@/question"
import { Todo } from "@/session/todo"
import { Skill } from "@/skill"
import { Session } from "@/session/session"
import { SessionStatus } from "@/session/status"
import { BackgroundJob } from "@/background/job"
import { Provider } from "@/provider/provider"
import { Git } from "@/git"
import { LSP } from "@/lsp/lsp"
import { Instruction } from "@/session/instruction"
import { Bus } from "@/bus"
import { Format } from "@/format"
import { Ripgrep } from "@opencode-ai/core/filesystem/ripgrep"
import * as Truncate from "@/tool/truncate"
import { InstanceState } from "@/effect/instance-state"
import { Reference } from "@/reference/reference"
import { RepositoryCache } from "@/reference/repository-cache"
import { RuntimeFlags } from "@/effect/runtime-flags"
import emulatorTools from "../../src/tool/lib/emulator_tools.json"
import { disposeAllInstances } from "../fixture/fixture"
import { TestConfig } from "../fixture/config"
import { testEffect } from "../lib/effect"

const HARMONY_NAPI_TOOL_NAMES = emulatorTools.map((tool) => tool.name)
const DEVECO_REGISTRY_TOOL_NAMES = ["hdc_log", "switch_cwd"] as const

const node = CrossSpawnSpawner.defaultLayer
const configLayer = TestConfig.layer({
  directories: () => InstanceState.directory.pipe(Effect.map((dir) => [path.join(dir, ".opencode")])),
})

const registryLayer = (auth = Auth.defaultLayer) =>
  ToolRegistry.layer
    .pipe(
      Layer.provide(configLayer),
      Layer.provide(Plugin.defaultLayer),
      Layer.provide(Question.defaultLayer),
      Layer.provide(Todo.defaultLayer),
      Layer.provide(Skill.defaultLayer),
      Layer.provide(Agent.defaultLayer),
      Layer.provide(Session.defaultLayer),
      Layer.provide(Layer.mergeAll(SessionStatus.defaultLayer, BackgroundJob.defaultLayer)),
      Layer.provide(Provider.defaultLayer),
      Layer.provide(Layer.mergeAll(Git.defaultLayer, RepositoryCache.defaultLayer)),
      Layer.provide(Reference.defaultLayer),
      Layer.provide(LSP.defaultLayer),
      Layer.provide(Instruction.defaultLayer),
    )
    .pipe(
      Layer.provide(auth),
      Layer.provide(FSUtil.defaultLayer),
      Layer.provide(Bus.layer),
      Layer.provide(FetchHttpClient.layer),
      Layer.provide(Format.defaultLayer),
      Layer.provide(node),
      Layer.provide(Ripgrep.defaultLayer),
      Layer.provide(Truncate.defaultLayer),
      Layer.provide(RuntimeFlags.defaultLayer),
    )

const devecoAuth = Layer.mock(Auth.Service)({
  get: (providerID) =>
    providerID === "deveco"
      ? Effect.succeed(
          new Auth.Oauth({
            type: "oauth",
            refresh: "refresh-token",
            access: "access-token",
            expires: 9_999_999_999,
          }),
        )
      : Effect.succeed(undefined),
  all: () => Effect.succeed({}),
})

const it = testEffect(Layer.mergeAll(registryLayer(), node, Agent.defaultLayer))
const loggedIn = testEffect(Layer.mergeAll(registryLayer(devecoAuth), node, Agent.defaultLayer))

afterEach(async () => {
  await disposeAllInstances()
})

describe("deveco builtin tools", () => {
  it.instance(
    "loads DevEco HarmonyOS registry built-ins on startup",
    () =>
      Effect.gen(function* () {
        const registry = yield* ToolRegistry.Service
        const ids = yield* registry.ids()

        for (const name of DEVECO_REGISTRY_TOOL_NAMES) {
          expect(ids).toContain(name)
        }
        expect(ids).toContain("skill")
      }),
    30_000,
  )

  it.instance(
    "loads Harmony NAPI dynamic tools from the internal plugin",
    () =>
      Effect.gen(function* () {
        const registry = yield* ToolRegistry.Service
        const ids = yield* registry.ids()

        for (const name of HARMONY_NAPI_TOOL_NAMES) {
          expect(ids).toContain(name)
        }
        expect(ids.filter((id) => HARMONY_NAPI_TOOL_NAMES.includes(id)).length).toBe(HARMONY_NAPI_TOOL_NAMES.length)
      }),
    30_000,
  )

  it.instance(
    "exposes key DevEco tools to the build agent prompt tool list",
    () =>
      Effect.gen(function* () {
        const registry = yield* ToolRegistry.Service
        const agents = yield* Agent.Service
        const build = yield* agents.get("build")
        if (!build) throw new Error("build agent not found")

        const promptIds = (yield* registry.tools({
          providerID: ProviderID.opencode,
          modelID: ModelID.make("gpt-5"),
          agent: build,
        })).map((tool) => tool.id)

        for (const name of [...DEVECO_REGISTRY_TOOL_NAMES, ...HARMONY_NAPI_TOOL_NAMES]) {
          expect(promptIds).toContain(name)
        }
      }),
    30_000,
  )

  it.instance(
    "preserves Harmony NAPI tool JSON schemas from emulator_tools.json",
    () =>
      Effect.gen(function* () {
        const registry = yield* ToolRegistry.Service
        const loaded = yield* registry.all()
        const byId = new Map(loaded.map((tool) => [tool.id, tool]))

        for (const spec of emulatorTools) {
          const tool = byId.get(spec.name)
          if (!tool) throw new Error(`tool ${spec.name} was not loaded`)

          expect(tool.jsonSchema).toMatchObject({
            type: "object",
            properties: spec.inputSchema.properties,
          })

          if ("required" in spec.inputSchema && spec.inputSchema.required) {
            expect(tool.jsonSchema?.required).toEqual(spec.inputSchema.required)
          }
        }
      }),
    30_000,
  )

  it.instance(
    "does not load arkts_knowledge_search without deveco oauth login",
    () =>
      Effect.gen(function* () {
        const registry = yield* ToolRegistry.Service
        const ids = yield* registry.ids()
        expect(ids).not.toContain("arkts_knowledge_search")
      }),
    30_000,
  )

  loggedIn.instance(
    "loads arkts_knowledge_search after deveco oauth login",
    () =>
      Effect.gen(function* () {
        const registry = yield* ToolRegistry.Service
        const ids = yield* registry.ids()
        expect(ids).toContain("arkts_knowledge_search")
      }),
    30_000,
  )

  it.instance(
    "keeps harmony build tools available to build agent but denied for plan agent",
    () =>
      Effect.gen(function* () {
        const registry = yield* ToolRegistry.Service
        const agents = yield* Agent.Service
        const build = yield* agents.get("build")
        const plan = yield* agents.get("plan")
        if (!build || !plan) throw new Error("expected build and plan agents")

        const ids = yield* registry.ids()
        expect(ids).toContain("build_project")

        expect(Permission.evaluate("build_project", "build_project", build.permission).action).not.toBe("deny")
        expect(Permission.evaluate("hdc_log", "hdc_log", build.permission).action).not.toBe("deny")
        expect(Permission.evaluate("switch_cwd", "switch_cwd", build.permission).action).not.toBe("deny")

        expect(Permission.evaluate("build_project", "build_project", plan.permission).action).toBe("deny")
        expect(Permission.evaluate("hdc_log", "hdc_log", plan.permission).action).toBe("deny")
        expect(Permission.evaluate("switch_cwd", "switch_cwd", plan.permission).action).toBe("deny")
      }),
    30_000,
  )
})
