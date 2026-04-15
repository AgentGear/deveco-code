import { Config } from "effect"

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function falsy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "false" || value === "0"
}

export namespace Flag {
  export const CODEGENIE_AUTO_SHARE = truthy("CODEGENIE_AUTO_SHARE")
  export const CODEGENIE_GIT_BASH_PATH = process.env["CODEGENIE_GIT_BASH_PATH"]
  export const CODEGENIE_CONFIG = process.env["CODEGENIE_CONFIG"]
  export declare const CODEGENIE_TUI_CONFIG: string | undefined
  export declare const CODEGENIE_CONFIG_DIR: string | undefined
  export const CODEGENIE_CONFIG_CONTENT = process.env["CODEGENIE_CONFIG_CONTENT"]
  export const CODEGENIE_DISABLE_AUTOUPDATE = truthy("CODEGENIE_DISABLE_AUTOUPDATE")
  export const CODEGENIE_ALWAYS_NOTIFY_UPDATE = truthy("CODEGENIE_ALWAYS_NOTIFY_UPDATE")
  export const CODEGENIE_DISABLE_PRUNE = truthy("CODEGENIE_DISABLE_PRUNE")
  export const CODEGENIE_DISABLE_TERMINAL_TITLE = truthy("CODEGENIE_DISABLE_TERMINAL_TITLE")
  export const CODEGENIE_PERMISSION = process.env["CODEGENIE_PERMISSION"]
  export const CODEGENIE_DISABLE_DEFAULT_PLUGINS = truthy("CODEGENIE_DISABLE_DEFAULT_PLUGINS")
  export const CODEGENIE_DISABLE_LSP_DOWNLOAD = truthy("CODEGENIE_DISABLE_LSP_DOWNLOAD")
  export const CODEGENIE_ENABLE_EXPERIMENTAL_MODELS = truthy("CODEGENIE_ENABLE_EXPERIMENTAL_MODELS")
  export const CODEGENIE_DISABLE_AUTOCOMPACT = truthy("CODEGENIE_DISABLE_AUTOCOMPACT")
  export const CODEGENIE_DISABLE_MODELS_FETCH = truthy("CODEGENIE_DISABLE_MODELS_FETCH")
  export const CODEGENIE_DISABLE_CLAUDE_CODE = !falsy("CODEGENIE_DISABLE_CLAUDE_CODE")
  export const CODEGENIE_DISABLE_CLAUDE_CODE_PROMPT =
    CODEGENIE_DISABLE_CLAUDE_CODE || truthy("CODEGENIE_DISABLE_CLAUDE_CODE_PROMPT")
  export const CODEGENIE_DISABLE_CLAUDE_CODE_SKILLS =
    CODEGENIE_DISABLE_CLAUDE_CODE || truthy("CODEGENIE_DISABLE_CLAUDE_CODE_SKILLS")
  export const CODEGENIE_DISABLE_EXTERNAL_SKILLS =
    CODEGENIE_DISABLE_CLAUDE_CODE_SKILLS || truthy("CODEGENIE_DISABLE_EXTERNAL_SKILLS")
  export const CODEGENIE_DISABLE_DEFAULT_SKILLS = truthy("CODEGENIE_DISABLE_DEFAULT_SKILLS")
  export declare const CODEGENIE_DISABLE_PROJECT_CONFIG: boolean
  export const CODEGENIE_FAKE_VCS = process.env["CODEGENIE_FAKE_VCS"]
  export declare const CODEGENIE_CLIENT: string
  export const CODEGENIE_SERVER_PASSWORD = process.env["CODEGENIE_SERVER_PASSWORD"]
  export const CODEGENIE_SERVER_USERNAME = process.env["CODEGENIE_SERVER_USERNAME"]
  export const CODEGENIE_ENABLE_QUESTION_TOOL = truthy("CODEGENIE_ENABLE_QUESTION_TOOL")

  // Experimental
  export const CODEGENIE_EXPERIMENTAL = truthy("CODEGENIE_EXPERIMENTAL")
  export const CODEGENIE_EXPERIMENTAL_FILEWATCHER = Config.boolean("CODEGENIE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  )
  export const CODEGENIE_EXPERIMENTAL_DISABLE_FILEWATCHER = Config.boolean(
    "CODEGENIE_EXPERIMENTAL_DISABLE_FILEWATCHER",
  ).pipe(Config.withDefault(false))
  export const CODEGENIE_EXPERIMENTAL_ICON_DISCOVERY =
    CODEGENIE_EXPERIMENTAL || truthy("CODEGENIE_EXPERIMENTAL_ICON_DISCOVERY")

  const copy = process.env["CODEGENIE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
  export const CODEGENIE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT =
    copy === undefined ? process.platform === "win32" : truthy("CODEGENIE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const CODEGENIE_ENABLE_EXA =
    truthy("CODEGENIE_ENABLE_EXA") || CODEGENIE_EXPERIMENTAL || truthy("CODEGENIE_EXPERIMENTAL_EXA")
  export const CODEGENIE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("CODEGENIE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const CODEGENIE_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("CODEGENIE_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const CODEGENIE_EXPERIMENTAL_OXFMT = CODEGENIE_EXPERIMENTAL || truthy("CODEGENIE_EXPERIMENTAL_OXFMT")
  export const CODEGENIE_EXPERIMENTAL_LSP_TY = truthy("CODEGENIE_EXPERIMENTAL_LSP_TY")
  export const CODEGENIE_EXPERIMENTAL_LSP_TOOL = CODEGENIE_EXPERIMENTAL || truthy("CODEGENIE_EXPERIMENTAL_LSP_TOOL")
  export const CODEGENIE_DISABLE_FILETIME_CHECK = Config.boolean("CODEGENIE_DISABLE_FILETIME_CHECK").pipe(
    Config.withDefault(false),
  )
  export const CODEGENIE_EXPERIMENTAL_PLAN_MODE = CODEGENIE_EXPERIMENTAL || truthy("CODEGENIE_EXPERIMENTAL_PLAN_MODE")
  export const CODEGENIE_EXPERIMENTAL_WORKSPACES = CODEGENIE_EXPERIMENTAL || truthy("CODEGENIE_EXPERIMENTAL_WORKSPACES")
  export const CODEGENIE_EXPERIMENTAL_MARKDOWN = !falsy("CODEGENIE_EXPERIMENTAL_MARKDOWN")
  export const CODEGENIE_MODELS_URL = process.env["CODEGENIE_MODELS_URL"]
  export const CODEGENIE_MODELS_PATH = process.env["CODEGENIE_MODELS_PATH"]
  export const CODEGENIE_DB = process.env["CODEGENIE_DB"]
  export const CODEGENIE_DISABLE_CHANNEL_DB = truthy("CODEGENIE_DISABLE_CHANNEL_DB")
  export const CODEGENIE_SKIP_MIGRATIONS = truthy("CODEGENIE_SKIP_MIGRATIONS")
  export const CODEGENIE_STRICT_CONFIG_DEPS = truthy("CODEGENIE_STRICT_CONFIG_DEPS")

  function number(key: string) {
    const value = process.env[key]
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for CODEGENIE_DISABLE_PROJECT_CONFIG
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "CODEGENIE_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("CODEGENIE_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for CODEGENIE_TUI_CONFIG
// This must be evaluated at access time, not module load time,
// because tests and external tooling may set this env var at runtime
Object.defineProperty(Flag, "CODEGENIE_TUI_CONFIG", {
  get() {
    return process.env["CODEGENIE_TUI_CONFIG"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for CODEGENIE_CONFIG_DIR
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "CODEGENIE_CONFIG_DIR", {
  get() {
    return process.env["CODEGENIE_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for CODEGENIE_CLIENT
// This must be evaluated at access time, not module load time,
// because some commands override the client at runtime
Object.defineProperty(Flag, "CODEGENIE_CLIENT", {
  get() {
    return process.env["CODEGENIE_CLIENT"] ?? "cli"
  },
  enumerable: true,
  configurable: false,
})
