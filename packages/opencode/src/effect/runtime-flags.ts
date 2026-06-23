import { Config, ConfigProvider, Context, Effect, Layer, Option } from "effect"
import { ConfigService } from "@/effect/config-service"

const bool = (name: string) => Config.boolean(name).pipe(Config.withDefault(false))
const boolTrue = (name: string) => Config.boolean(name).pipe(Config.withDefault(true));
const positiveInteger = (name: string) =>
  Config.number(name).pipe(
    Config.map((value) => (Number.isInteger(value) && value > 0 ? value : undefined)),
    Config.orElse(() => Config.succeed(undefined)),
  )
const experimental = bool("DEVECO_EXPERIMENTAL")
const enabledByExperimental = (name: string) =>
  Config.all({ experimental, enabled: Config.boolean(name).pipe(Config.option) }).pipe(
    Config.map((flags) => Option.getOrElse(flags.enabled, () => flags.experimental)),
  )

export class Service extends ConfigService.Service<Service>()("@opencode/RuntimeFlags", {
  autoShare: bool("DEVECO_AUTO_SHARE"),
  pure: bool("DEVECO_PURE"),
  disableDefaultPlugins: bool("DEVECO_DISABLE_DEFAULT_PLUGINS"),
  disableDefaultSkills: bool("DEVECO_DISABLE_DEFAULT_SKILLS"),
  disableEmbeddedWebUi: bool("DEVECO_DISABLE_EMBEDDED_WEB_UI"),
  disableExternalSkills: bool("DEVECO_DISABLE_EXTERNAL_SKILLS"),
  disableLspDownload: bool("DEVECO_DISABLE_LSP_DOWNLOAD"),
  disableClaudeCodePrompt: Config.all({
    broad: boolTrue("DEVECO_DISABLE_CLAUDE_CODE"),
    direct: boolTrue("DEVECO_DISABLE_CLAUDE_CODE_PROMPT"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  disableClaudeCodeSkills: Config.all({
    broad: boolTrue("DEVECO_DISABLE_CLAUDE_CODE"),
    direct: boolTrue("DEVECO_DISABLE_CLAUDE_CODE_SKILLS"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  enableExa: Config.all({
    experimental,
    enabled: bool("DEVECO_ENABLE_EXA"),
    legacy: bool("DEVECO_EXPERIMENTAL_EXA"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled || flags.legacy)),
  enableParallel: Config.all({
    enabled: bool("DEVECO_ENABLE_PARALLEL"),
    legacy: bool("DEVECO_EXPERIMENTAL_PARALLEL"),
  }).pipe(Config.map((flags) => flags.enabled || flags.legacy)),
  enableExperimentalModels: bool("DEVECO_ENABLE_EXPERIMENTAL_MODELS"),
  enableQuestionTool: bool("DEVECO_ENABLE_QUESTION_TOOL"),
  experimentalScout: enabledByExperimental("DEVECO_EXPERIMENTAL_SCOUT"),
  experimentalReferences: enabledByExperimental("DEVECO_EXPERIMENTAL_REFERENCES"),
  experimentalBackgroundSubagents: Config.all({
    experimental,
    enabled: boolTrue("DEVECO_EXPERIMENTAL_BACKGROUND_SUBAGENTS"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled)),
  experimentalLspTy: bool("DEVECO_EXPERIMENTAL_LSP_TY"),
  experimentalLspTool: enabledByExperimental("DEVECO_EXPERIMENTAL_LSP_TOOL"),
  experimentalOxfmt: enabledByExperimental("DEVECO_EXPERIMENTAL_OXFMT"),
  experimentalPlanMode: enabledByExperimental("DEVECO_EXPERIMENTAL_PLAN_MODE"),
  experimentalEventSystem: enabledByExperimental("DEVECO_EXPERIMENTAL_EVENT_SYSTEM"),
  experimentalWorkspaces: enabledByExperimental("DEVECO_EXPERIMENTAL_WORKSPACES"),
  experimentalIconDiscovery: enabledByExperimental("DEVECO_EXPERIMENTAL_ICON_DISCOVERY"),
  outputTokenMax: positiveInteger("DEVECO_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  bashDefaultTimeoutMs: positiveInteger("DEVECO_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  experimentalNativeLlm: bool("DEVECO_EXPERIMENTAL_NATIVE_LLM"),
  experimentalWebSockets: bool("DEVECO_EXPERIMENTAL_WEBSOCKETS"),
  client: Config.string("DEVECO_CLIENT").pipe(Config.withDefault("cli")),
}) {}

export type Info = Context.Service.Shape<typeof Service>

const emptyConfigLayer = Service.defaultLayer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
  Layer.orDie,
)

export const layer = (overrides: Partial<Info> = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const flags = yield* Service
      return Service.of({ ...flags, ...overrides })
    }),
  ).pipe(Layer.provide(emptyConfigLayer))

export const defaultLayer = Service.defaultLayer.pipe(Layer.orDie)

export const node = LayerNode.make(defaultLayer, [])

export * as RuntimeFlags from "./runtime-flags"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
