import { Schema } from "effect"
import { Model as ModelSchema, type Info as ProviderInfo } from "../config/provider"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import * as Log from "@opencode-ai/core/util/log"

type Model = Schema.Schema.Type<typeof ModelSchema>
type ModelsMap = Record<string, Model>

const DEVECO_BASE_URL = "https://cn.devecostudio.huawei.com"

const log = Log.create({ service: "deveco-models" })

// ============ Default (fallback) config ============

export const DEVECO_DEFAULTS = {
  provider: {
    name: "DevEco Code",
    npm: "@ai-sdk/openai-compatible",
    api: `${DEVECO_BASE_URL}/sse/codeGenie/maas/v2`,
    env: [] as string[],
    models: {
      "glm-5": {
        name: "glm-5",
        reasoning: true,
        tool_call: true,
        limit: { context: 202752, output: 131072 },
        modalities: { input: ["text"], output: ["text"] },
      },
      "Qwen2.5-VL-72B": {
        name: "Qwen2.5-VL-72B",
        limit: { context: 32768, output: 8192 },
        modalities: { input: ["text", "image"], output: ["text"] },
      },
    },
  } satisfies ProviderInfo,
  taskDefaultModelMap: {
    small_model: "glm-5",
    ui_verification: "Qwen2.5-VL-72B",
    blacklist: "Qwen2.5-VL-72B",
  } as Record<string, string>,
}

/** @deprecated Use getDevecoProviderConfig() for dynamic model fetching */
export const DEVECO_PROVIDER_CONFIG: ProviderInfo = DEVECO_DEFAULTS.provider

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

function mapModelConfigToInternal(config: Schema.Schema.Type<typeof ModelConfigSchema>): Model {
  const limit: { context?: number; output?: number } = {}
  if (config.context_window) limit.context = config.context_window
  const outputLimit = parseOutputLimit(config.output)
  if (outputLimit) limit.output = outputLimit

  return {
    name: config.model_id,
    ...(config.thinking_mode === "on" ? { reasoning: true } : {}),
    ...(config.tool_call_mode === "tool_calls" ? { tool_call: true } : {}),
    ...(Object.keys(limit).length > 0 ? { limit } : {}),
    ...(config.input_modalities && config.input_modalities.length > 0 ? { modalities: { input: config.input_modalities, output: ["text"] } } : {}),
  } as Model
}

// ============ Cache ============

let cachedConfig: ProviderInfo | null = null
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

  log.info("Fetched models config", { models, taskDefaultModelMap })

  return { models, taskDefaultModelMap }
}

function filterBlacklist(models: ModelsMap, blacklist: string[]): ProviderInfo {
  const filteredModels = Object.fromEntries(
    Object.entries(models).filter(([id]) => !blacklist.includes(id)),
  )
  return { ...STATIC_PROVIDER_FIELDS, models: filteredModels }
}

// ============ Public API ============

export async function getDevecoProviderConfig(accessToken: string): Promise<ProviderInfo> {
  if (cachedConfig) return cachedConfig

  const defaultBlacklist = DEVECO_DEFAULTS.taskDefaultModelMap.blacklist?.split(",") ?? []

  try {
    const { models, taskDefaultModelMap } = await fetchModelsFromAPI(accessToken)

    if (!models || Object.keys(models).length === 0) {
      log.warn("API returned empty models, using defaults")
      return filterBlacklist(DEVECO_DEFAULTS.provider.models, defaultBlacklist)
    }

    cachedConfig = filterBlacklist(models, taskDefaultModelMap?.blacklist?.split(",") ?? [])
    cachedTaskDefaultModelMap = taskDefaultModelMap ?? DEVECO_DEFAULTS.taskDefaultModelMap
    return cachedConfig
  } catch (err) {
    log.warn("Failed to fetch models, using defaults", { error: String(err) })
    return filterBlacklist(DEVECO_DEFAULTS.provider.models, defaultBlacklist)
  }
}

const STATIC_PROVIDER_FIELDS = {
  name: "DevEco Code",
  npm: "@ai-sdk/openai-compatible",
  api: `${DEVECO_BASE_URL}/sse/codeGenie/maas/v2`,
  env: [] as string[],
}

export function getTaskDefaultModelMap(): Record<string, string> {
  return cachedTaskDefaultModelMap ?? DEVECO_DEFAULTS.taskDefaultModelMap
}

