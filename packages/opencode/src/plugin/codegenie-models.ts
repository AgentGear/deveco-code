import type { Config } from "../config/config"

/**
 * CodeGenie 模型资源定义
 * 当用户通过 CodeGenie OAuth 登录后，这些模型会注入到 provider 系统中
 */
export const CODEGENIE_PROVIDER_CONFIG = {
  name: "CodeGenie",
  npm: "@ai-sdk/openai-compatible",
  api: "https://cn.devecostudio.huawei.com/sse/codeGenie/maas/v2",
  env: [],
  models: {
     "glm-5": {
      name: "glm-5",
      reasoning: true,
      tool_call: true,
      limit: { context: 202752, output: 131072 },
    },
    "deepseek-v3.2": {
      name: "deepseek-v3.2",
      tool_call: true,
      limit: { context: 131072, output: 65536 },
    },
  },
} satisfies Config.Provider
