<p align="center">
  <h1 align="center">DevEco Code</h1>
</p>
<p align="center">An AI Agent tool for HarmonyOS application development.</p>
<p align="center">
  <a href="README.md">简体中文</a> · English
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@deveco/deveco-code"><img alt="NPM Version" src="https://img.shields.io/npm/v/@deveco/deveco-code.svg" /></a>
  <a href="https://www.npmjs.com/package/@deveco/deveco-code"><img alt="NPM Downloads" src="https://img.shields.io/npm/dm/@deveco/deveco-code.svg" /></a>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%3E%3D22-green.svg" />
  <img alt="platform" src="https://img.shields.io/badge/platform-macOS%20(Arm%20%7C%20x64)%20%7C%20Windows-blue.svg" />
  <a href="https://developer.huawei.com/consumer/en/deveco-studio/"><img alt="DevEco Studio" src="https://img.shields.io/badge/DevEco%20Studio-%3E%3D6.1-orange.svg" /></a>
  <a href="https://gitcode.com/openharmony-sig/deveco-code/blob/develop/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-green.svg" /></a>
</p>

<p align="center">
  <img src="https://raw.gitcode.com/openharmony-sig/deveco-code/raw/develop/assets/readme/readme-screenshot.png" alt="DevEco Code" width="600">
</p>

***

## Quick Start

```bash
# 1. Install
npm install -g @deveco/deveco-code

# 2. Launch
deveco

# 3. Start chatting — describe your HarmonyOS development needs right in the terminal
Example prompts:
- Explain the architecture of this repository
- Help me refactor the login_check function
- Help me check for and fix syntax errors
```

> We recommend using the [official npm registry](https://registry.npmjs.org/) or the [npmmirror (Taobao) registry](https://registry.npmmirror.com/) for installation. Other mirrors may have sync delays that cause installation failures or outdated versions.

> For build, run, and related capabilities, install [DevEco Studio](https://developer.huawei.com/consumer/en/deveco-studio/) and set the `DEVECO_HOME` environment variable.

## Overview

DevEco Code is an AI Agent tool for HarmonyOS development. It supports code writing, project building, device deployment, documentation lookup, runtime debugging, and ArkTS issue fixing.

DevEco Code extends the open-source project [OpenCode](https://opencode.ai), keeping its terminal UI, configuration system, and Provider / MCP / Skill / Plugin capabilities, and adds HarmonyOS-focused integrations for DevEco Studio, Hvigor, HDC, Skills, the HarmonyOS knowledge base, ArkTS checking, and device debugging.

## Supported Platforms

DevEco Code is distributed via npm for the following platforms:

| Platform | Architecture | Notes |
| --- | --- | --- |
| Windows | x64 | Windows 11 |
| macOS | arm64 (Apple Silicon) | M-series chips |
| macOS | x64 (Intel) | Intel Mac |

> Linux is not supported. HarmonyOS builds, emulators, and on-device debugging require [DevEco Studio](https://developer.huawei.com/consumer/en/deveco-studio/), which is currently available for Windows and macOS only.

## Recommended Configuration

**Operating system**

- **Windows**: Windows 11 22H2 or later
- **macOS**: macOS 15 Sequoia or later

**Hardware**

- **Everyday use** (short sessions, single-module edits, chat and code editing): 8 GB RAM or more
- **Heavy use** (large projects, long sessions, frequent builds and emulator/device debugging): 16 GB RAM or more; reserve at least 20 GB free disk space for DevEco Studio, SDK, emulators, and build caches

**Runtime and toolchain**

- [Node.js](https://nodejs.org) **22 or higher**
- [DevEco Studio](https://developer.huawei.com/consumer/en/deveco-studio/) **6.1 or higher** (builds, Hvigor, HDC, emulator/device run)
- `DEVECO_HOME` set to your DevEco Studio installation directory

**Terminal shell**

- Windows: PowerShell 7+ (recommended), PowerShell 5.1+
- macOS: Zsh (recommended), Bash

**Network**

- Stable internet connection (Huawei account sign-in, model API calls, HarmonyOS knowledge search, etc.)

## Prerequisites

DevEco Code is distributed via npm. Prepare the following before installation:

1. Install [Node.js](https://nodejs.org); **version 22 or higher is recommended**
2. (Optional) Install [DevEco Studio](https://developer.huawei.com/consumer/en/deveco-studio/); **version 6.1 or higher is recommended**; if not installed, HarmonyOS app build, deployment, and other tools will be unavailable
3. (Optional) Set `DEVECO_HOME` to point to your DevEco Studio installation directory. Default path examples:
   - **macOS**: `/Applications/DevEco-Studio.app`
   - **Windows**: `C:\Program Files\Huawei\DevEco Studio`

Verify your Node.js environment in the terminal:

```bash
node -v
npm -v
```

## Install & Uninstall

Install:

```bash
npm install -g @deveco/deveco-code
```

Check version and launch:

```bash
deveco --version
deveco
```

Update:

```bash
deveco upgrade
```

Uninstall runtime data and the global package:

```bash
deveco uninstall
npm uninstall -g @deveco/deveco-code
```

## Login & Logout

DevEco Code requires signing in with a Huawei account. The first time you run `deveco`, the terminal guides you through sign-in; you can also run:

```bash
deveco auth login
```

Logging out clears the local sign-in state for the current Huawei account; you will need to sign in again on the next launch:

```bash
deveco auth logout
```

## Model Configuration

After signing in, you can use the free model channels provided by DevEco Code.

Type `/models` in DevEco Code to open the model configuration UI. The `GLM-5.1` model is currently available for free, with a default limit of 50 requests per minute per account. Press `Ctrl+A` to open the Provider selection UI and configure supported third-party models.

You can also configure models in `deveco.jsonc`:

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

**UI Verification Configuration**

UI verification is an optional capability during the feature verification phase, used to verify whether the interface matches requirement descriptions.

This feature requires a multimodal model: when logged in, it defaults to using the built-in Qwen3-VL model; when not logged in, UI verification is skipped.

To configure a third-party multimodal model (Qwen series only), specify it in the `agent` section of `deveco.jsonc`. Example using qwen3-vl-plus:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "alibaba",
      "options": {
        "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "apiKey": "your-api-key",
      },
      "models": {
        "qwen3-vl-plus": {
          "modalities": {
            "input": ["text", "image"],
            "output": ["text"],
          },
        },
      },
    },
  },
  "agent": {
    "ui_verification": {
      "mode": "subagent",
      "model": "myprovider/qwen3-vl-plus", // Format: <provider-name>/<model-name>
      "hidden": true,
    },
  },
}
```

Configuration file lookup priority:

1. `.deveco/deveco.jsonc` in the project directory
2. `deveco.jsonc` in the project directory
3. `.config/deveco/deveco.jsonc` in the user home directory

## Agent Configuration

DevEco Code provides the following Agent modes for HarmonyOS development (press `Tab` to switch):

- `Build`: Default mode for project scaffolding, code generation, configuration fixes, test execution, deployment, and release
- `Plan`: Requirement breakdown, technical design, release planning, test planning, and documentation
- `Goal`: End-to-end feature delivery using the SDD five-phase flow from requirements through implementation and build verification

## HarmonyOS Capabilities

DevEco Code integrates common HarmonyOS development tools:

| Tool | Description |
| --- | --- |
| `build_project` | Build the project and export build artifacts |
| `start_app` | Run the application on an emulator or physical device |
| `hdc_log` | Collect/clear device logs; list connected emulators |
| `verify_ui` | Execute UI operations to verify features |
| `check_ets_files` | ArkTS static syntax checking |
| `arkts_knowledge_search` | HarmonyOS knowledge search |
| `switch_cwd` | Switch the build project path |

Common scenarios include creating a HarmonyOS project from scratch, incremental page development, fixing build errors, and on-device debugging.

## Extensions

DevEco Code is compatible with OpenCode's Skill, MCP, and Plugin extension mechanisms.

> After adding or changing Skill, MCP, or Plugin configuration, exit and run `deveco` again for changes to take effect.

### Skills

```bash
npx skills add vercel-labs/agent-skills
```

You can also place Skills in `~/.config/deveco/skills`.

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
    "node_modules/oh-my-opencode/dist/index.js"
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

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a Pull Request.

## Help & Support

- For frequently asked questions, see the [FAQ document](https://gitcode.com/openharmony-sig/deveco-code/wiki/FAQ.md)
- For common terminal commands (such as `/models`, `/connect`, etc.), see the [OpenCode TUI documentation](https://opencode.ai/docs/tui/)
- Feedback & Discussion [GitCode Issue](https://gitcode.com/openharmony-sig/deveco-code/issues)

## License

[MIT License](LICENSE)

## Built on OpenCode

This project extends the open-source project [OpenCode](https://opencode.ai). DevEco Code is **not** produced by the OpenCode team and is not affiliated with or associated with the OpenCode team in any way. For DevEco Code–related issues, please use [GitCode Issues](https://gitcode.com/openharmony-sig/deveco-code/issues) rather than contacting the OpenCode community.
