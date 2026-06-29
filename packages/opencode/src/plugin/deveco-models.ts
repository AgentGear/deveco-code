import { Schema } from "effect"
import { Effect } from "effect"

async function log(effect: Effect.Effect<void>) {
  const { AppRuntime } = await import("@/effect/app-runtime")
  return AppRuntime.runPromise(effect)
}
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import * as ModelsDev from "@opencode-ai/core/models-dev"

type ModelsMap = Record<string, ModelsDev.Model>

const DEVECO_BASE_URL = "https://cn.devecostudio.huawei.com"
const DEVECO_PROVIDER_ID = "deveco"
export const DEVECO_API_URL = `${DEVECO_BASE_URL}/sse/codeGenie/maas/v2`
const DEVECO_NPM = "@ai-sdk/openai-compatible"

function makeModel(modelId: string, opts: {
  reasoning?: boolean
  toolcall?: boolean
  context?: number
  output?: number
  inputModalities?: Array<"text" | "audio" | "image" | "video" | "pdf">
}): ModelsDev.Model {
  const inputMods = opts.inputModalities ?? ["text"]
  return {
    id: modelId,
    name: modelId,
    release_date: "",
    attachment: false,
    reasoning: opts.reasoning ?? false,
    temperature: false,
    tool_call: opts.toolcall ?? true,
    limit: {
      context: opts.context ?? 32768,
      output: opts.output ?? 8192,
    },
    cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
    modalities: {
      input: inputMods,
      output: ["text"],
    },
    provider: {
      npm: DEVECO_NPM,
      api: DEVECO_API_URL,
    },
  }
}

function makeProviderInfo(models: ModelsMap): ModelsDev.Provider {
  return {
    id: DEVECO_PROVIDER_ID,
    name: "DevEco Code",
    env: [],
    npm: DEVECO_NPM,
    api: DEVECO_API_URL,
    models,
  }
}

// ============ Default (fallback) config ============

const defaultModels: ModelsMap = {
  "glm-5": makeModel("glm-5", {
    reasoning: true,
    toolcall: true,
    context: 202752,
    output: 131072,
    inputModalities: ["text"],
  }),
  "Qwen2.5-VL-72B": makeModel("Qwen2.5-VL-72B", {
    context: 32768,
    output: 8192,
    inputModalities: ["text", "image"],
  }),
}

export const DEVECO_DEFAULTS = {
  provider: makeProviderInfo(defaultModels),
  taskDefaultModelMap: {
    small_model: "glm-5",
    ui_verification: "Qwen3_VL_235B_A22B_Instruct",
    blacklist: "Qwen2.5-VL-72B",
  } as Record<string, string>,
}

/** @deprecated Use getDevecoProviderConfig() for dynamic model fetching */
export const DEVECO_PROVIDER_CONFIG: ModelsDev.Provider = DEVECO_DEFAULTS.provider

// ============ API response schema ============

const ModelConfigSchema = Schema.Struct({
  id: Schema.Number,
  model_id: Schema.String,
  thinking_mode: Schema.optional(Schema.String),
  input_modalities: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
  context_window: Schema.optional(Schema.Number),
  output: Schema.optional(Schema.Union([Schema.String, Schema.Number])),
  tool_choice: Schema.optional(Schema.String),
  tool_call_mode: Schema.optional(Schema.String),
})

const InnerModelSchema = Schema.Struct({
  protocol: Schema.String,
  group_name: Schema.String,
  group_name_cn: Schema.optional(Schema.String),
  model_configs: Schema.Array(ModelConfigSchema),
})

const ApiResponseSchema = Schema.Struct({
  code: Schema.Number,
  body: Schema.Struct({
    version: Schema.optional(Schema.Number),
    inner_models: Schema.Array(InnerModelSchema),
  }),
})

const decodeResponse = Schema.decodeUnknownSync(ApiResponseSchema)

// ============ Mapping logic ============

function parseOutputLimit(output: string | number | undefined): number | undefined {
  if (output == null) return undefined
  if (typeof output === "number") return output
  const num = parseInt(output, 10)
  return isNaN(num) ? undefined : num
}

function mapModelConfigToInternal(config: Schema.Schema.Type<typeof ModelConfigSchema>): ModelsDev.Model {
  const inputMods =
    config.input_modalities && config.input_modalities.length > 0
      ? [...config.input_modalities]
      : ["text"]
  return makeModel(config.model_id, {
    reasoning: config.thinking_mode === "on",
    toolcall: config.tool_call_mode === "tool_calls",
    context: config.context_window,
    output: parseOutputLimit(config.output),
    inputModalities: inputMods as Array<"text" | "audio" | "image" | "video" | "pdf">,
  })
}

// ============ Cache ============

let cachedConfig: ModelsDev.Provider | null = null
let cachedTaskDefaultModelMap: Record<string, string> | null = null

// ============ API fetch ============

const API_ENDPOINT = `${DEVECO_BASE_URL}/codeGenie/modelConfig?localVersion=0&pluginVersion=CLI.${InstallationVersion}`

async function fetchModelsFromAPI(accessToken: string): Promise<{ models: ModelsMap; taskDefaultModelMap: Record<string, string> | undefined }> {
  const response = await fetch(API_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Model config API returned ${response.status}: ${body}`)
  }

  const raw = await response.json()
  const data = decodeResponse(raw)

  // Extract task_default_model_map from raw JSON (not in Schema to avoid effect 4.x beta decoding issues)
  let taskDefaultModelMap: Record<string, string> | undefined = undefined
  const rawInnerModels = (raw as any)?.body?.inner_models
  if (Array.isArray(rawInnerModels)) {
    for (const group of rawInnerModels) {
      if (group.task_default_model_map && typeof group.task_default_model_map === "object") {
        taskDefaultModelMap = group.task_default_model_map as Record<string, string>
      }
    }
  }

  if (data.code !== 200) {
    throw new Error(`Model config API returned code ${data.code}`)
  }

  const models: ModelsMap = {}
  for (const group of data.body.inner_models) {
    for (const config of group.model_configs) {
      models[config.model_id] = mapModelConfigToInternal(config)
    }
  }

  await log(Effect.logInfo("Fetched models config", { service: "deveco-models", models, taskDefaultModelMap }))

  return { models, taskDefaultModelMap }
}

function filterBlacklist(models: ModelsMap, blacklist: string[]): ModelsDev.Provider {
  const filteredModels = Object.fromEntries(
    Object.entries(models).filter(([id]) => !blacklist.includes(id)),
  )
  return makeProviderInfo(filteredModels)
}

// ============ Public API ============

export async function getDevecoProviderConfig(accessToken: string): Promise<ModelsDev.Provider> {
  if (cachedConfig) return cachedConfig

  const defaultBlacklist = DEVECO_DEFAULTS.taskDefaultModelMap.blacklist?.split(",") ?? []

  try {
    const { models, taskDefaultModelMap } = await fetchModelsFromAPI(accessToken)

    if (!models || Object.keys(models).length === 0) {
      await log(Effect.logWarning("API returned empty models, using defaults", { service: "deveco-models" }))
      return filterBlacklist(DEVECO_DEFAULTS.provider.models, defaultBlacklist)
    }

    cachedConfig = filterBlacklist(models, taskDefaultModelMap?.blacklist?.split(",") ?? [])
    cachedTaskDefaultModelMap = taskDefaultModelMap ?? DEVECO_DEFAULTS.taskDefaultModelMap
    return cachedConfig
  } catch (err) {
    await log(Effect.logWarning("Failed to fetch models, using defaults", { service: "deveco-models", error: String(err) }))
    return filterBlacklist(DEVECO_DEFAULTS.provider.models, defaultBlacklist)
  }
}

export function getTaskDefaultModelMap(): Record<string, string> {
  return cachedTaskDefaultModelMap ?? DEVECO_DEFAULTS.taskDefaultModelMap
}
