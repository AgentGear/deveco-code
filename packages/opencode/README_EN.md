# DevEco Code

An open-source AI Agent for HarmonyOS application development.

[![npm](https://img.shields.io/npm/v/@deveco/deveco-code?style=flat-square&label=npm)](https://www.npmjs.com/package/@deveco/deveco-code)
[![license](https://img.shields.io/npm/l/@deveco/deveco-code?style=flat-square&label=license)](https://gitcode.com/openharmony-sig/deveco-code/blob/main/LICENSE)
[![GitCode](https://img.shields.io/badge/GitCode-openharmony--sig%2Fdeveco--code-blue?style=flat-square)](https://gitcode.com/openharmony-sig/deveco-code)

[npm Package](https://www.npmjs.com/package/@deveco/deveco-code) |
[GitCode Repository](https://gitcode.com/openharmony-sig/deveco-code) |
[OpenCode](https://opencode.ai)

***

## Quick Start

```bash
# 1. Install
npm install -g @deveco/deveco-code

# 2. Launch
deveco

# 3. Start chatting — describe your HarmonyOS development needs right in the terminal
```

> To build, run, and debug HarmonyOS projects, please install [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/) and configure the `DEVECO_HOME` environment variable.

## Overview

DevEco Code is an AI Agent tool designed for HarmonyOS application development. It supports code writing, project building, device deployment, documentation lookup, runtime debugging, and ArkTS issue fixing.

DevEco Code is built on top of the open-source project [OpenCode](https://opencode.ai), retaining its terminal UI, configuration system, Provider/MCP/Skill/Plugin capabilities, and extending them with integrations for DevEco Studio, `hvigorw`, `hdc`, ArkTS checking, and device debugging for HarmonyOS projects.

## Supported Platforms

- Windows x64
- macOS Apple Silicon
- macOS Intel x64

## Prerequisites

DevEco Code is distributed via npm. Please set up the following before installation:

1. Install [Node.js LTS](https://nodejs.org)
2. For HarmonyOS project build, run, and debug capabilities, install [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/)
3. Configure the `DEVECO_HOME` environment variable to point to the DevEco Studio installation directory

Verify your Node.js environment in the terminal:

```bash
node -v
npm -v
```

## Install & Uninstall

```bash
# Install
npm install -g @deveco/deveco-code

# Check version
deveco --version

# Launch
deveco

# Update
deveco upgrade

# Uninstall runtime data
deveco uninstall

# Uninstall npm global package
npm uninstall -g @deveco/deveco
```

> On macOS, if you encounter permission issues with global installation, try `sudo -i npm install -g @deveco/deveco-code`.

## Login & Models

After launching `deveco`, you can log in with a Huawei account. Once logged in, you can use the free model channels provided by DevEco Code; without logging in, you can still use OpenCode's Provider configuration system to configure your own models.

```bash
# Log out
deveco auth logout
```

Type `/models` in DevEco Code to open the model configuration UI. Two models — `glm-5` and `deepseek-v3.2` — are currently available for free, with a default rate limit of 50 requests per minute per account. You can also press `Ctrl+A` to open the Provider selection UI and configure OpenAI-compatible models from providers such as Zhipu and Alibaba.

You can also configure models via `deveco.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "deveco": {
      "name": "DevEco Code",
      "models": {
        "glm-5": {
          "tool_call": true,
          "limit": {
            "context": 200000,
            "output": 8192
          }
        }
      },
      "options": {
        "baseURL": "https://api.openbitfun.com/v1",
        "apiKey": "{env:DEVECO_API_KEY}"
      }
    }
  }
}
```

Configuration file lookup priority:

1. `.deveco/deveco.jsonc` in the project directory
2. `deveco.jsonc` in the project directory
3. `.config/deveco/deveco.jsonc` in the user home directory

## Agent Modes

DevEco Code provides the following Agent modes for HarmonyOS development (press `Tab` to switch):

- `build`: Default mode, suitable for project scaffolding, code generation, configuration fixes, test execution, deployment, and release
- `plan`: Suitable for requirement breakdown, technical design, release planning, test planning, and documentation generation
- `sdd`: Suitable for spec definition, spec-driven development, code generation, and feature verification

## HarmonyOS Features

DevEco Code integrates common HarmonyOS development tools:

| Tool | Description |
| --- | --- |
| `build_project` | Build the project and export build artifacts |
| `start_app` | Run the application on an emulator or physical device |
| `hdc_log` | Collect/clear device logs; list connected emulators |
| `check_ets_files` | ArkTS static syntax checking |
| `arkts_knowledge_search` | HarmonyOS knowledge search (requires Huawei account login) |
| `switch_cwd` | Switch the build project path |

Common use cases include: creating a HarmonyOS project from scratch, incrementally developing pages, fixing compilation errors, debugging on physical devices, and multimodal image-to-code UI generation.

## Extensions

DevEco Code is compatible with OpenCode's Skill, MCP, and Plugin extension mechanisms.

### Skills

```bash
npx skills add vercel-labs/agent-skills
```

You can also place Skills in `~/.config/deveco/skills`; they will be loaded after restarting DevEco Code.

### MCP

Configure MCP in `~/.config/deveco/deveco.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "playwright": {
      "type": "local",
      "command": ["npx", "@playwright/mcp@latest"],
      "enabled": true
    }
  }
}
```

### Plugins

```bash
npm install -g oh-my-opencode
```

Then configure the plugin entry in `deveco.jsonc`:

```jsonc
{
  "plugin": [
    "file:///C:/Users/<username>/AppData/Roaming/npm/node_modules/oh-my-opencode/dist/index.js"
  ]
}
```

## Migrating from OpenCode

To migrate from OpenCode to DevEco Code, move your configuration files to the DevEco Code directory. For the main configuration file:

```powershell
# Windows PowerShell
Copy-Item -Force "{source_path}\opencode.jsonc" "~\.config\deveco\deveco.jsonc"
```

```bash
# macOS
cp {source_path}/opencode.jsonc ~/.config/deveco/deveco.jsonc
```

Skills, Agents, and Plugins can also be migrated to the corresponding directories under `~/.config/deveco`; MCP configuration entries can be moved into `deveco.jsonc`.

## FAQ

### What is the relationship between DevEco Code and OpenCode?

DevEco Code is built on top of the open-source project [OpenCode](https://opencode.ai). It retains OpenCode's terminal UI, Provider, MCP, Skill, Plugin, and configuration systems, and adds HarmonyOS-specific capabilities including project building, device deployment, log collection, ArkTS checking, and runtime debugging.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](../../CONTRIBUTING.md) before submitting a Pull Request.

## License

[MIT License](../../LICENSE)

## Acknowledgment

This project is built on the open-source project [OpenCode](https://opencode.ai). DevEco Code is **not** produced by the OpenCode team, nor is it affiliated with or associated with the OpenCode team in any way. For any issues related to DevEco Code, please file them in this repository's Issue tracker rather than contacting the OpenCode community.

***

**Feedback & Discussion** [GitCode Issue](https://gitcode.com/openharmony-sig/deveco-code/issues)
