<p align="center">
  <h1 align="center">DevEco Code</h1>
</p>
<p align="center">面向 HarmonyOS 开发场景的 AI Agent 工具。</p>
<p align="center">
  <a href="README.en.md">English</a> · 简体中文
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@deveco/deveco-code"><img alt="NPM Version" src="https://img.shields.io/npm/v/@deveco/deveco-code.svg" /></a>
  <a href="https://www.npmjs.com/package/@deveco/deveco-code"><img alt="NPM Downloads" src="https://img.shields.io/npm/dm/@deveco/deveco-code.svg" /></a>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%3E%3D22-green.svg" />
  <img alt="platform" src="https://img.shields.io/badge/platform-macOS%20(Arm%20%7C%20x64)%20%7C%20Windows-blue.svg" />
  <a href="https://developer.huawei.com/consumer/cn/deveco-studio/"><img alt="DevEco Studio" src="https://img.shields.io/badge/DevEco%20Studio-%3E%3D6.1-orange.svg" /></a>
  <a href="https://gitcode.com/openharmony-sig/deveco-code/blob/develop/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-green.svg" /></a>
</p>

<p align="center">
  <img src="https://raw.gitcode.com/openharmony-sig/deveco-code/raw/develop/assets/readme/readme-screenshot.png" alt="DevEco Code" width="600">
</p>

***

## 快速开始

```bash
# 1. 安装
npm install -g @deveco/deveco-code

# 2. 启动
deveco

# 3. 开始对话 —— 在终端中直接描述你的 HarmonyOS 开发需求
提示词示例：
- 解释一下代码库的架构
- 帮我重构login_check这个函数
- 帮我检查并修复语法错误
```

> 建议使用 [npm 官方源](https://registry.npmjs.org/) 或 [淘宝镜像源](https://registry.npmmirror.com/) 安装，其他镜像源可能因同步延迟导致安装失败或版本滞后。

> 如需编译构建、设备运行等能力，请先安装 [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/) 并配置 `DEVECO_HOME` 环境变量。

## 简介

DevEco Code 是一款面向 HarmonyOS 开发场景的 AI Agent 工具，支持代码编写、编译构建、设备运行、文档查阅、运行时调试及 ArkTS 问题修复等能力。

DevEco Code 基于开源项目 OpenCode 扩展开发，保留了 OpenCode 的终端交互、配置体系、 Provider / MCP / Skill / Plugin 等能力，并针对 HarmonyOS 工程增加了 DevEco Studio、Hvigor、HDC、Skill、HarmonyOS 知识库、ArkTS 检查和设备调试相关集成。

## 支持平台

DevEco Code 当前通过 npm 提供以下平台安装包：

| 平台 | 架构 | 说明 |
| --- | --- | --- |
| Windows | x64 | Windows 11 |
| macOS | arm64（Apple Silicon） | M 系列芯片 |
| macOS | x64（Intel） | Intel 芯片 Mac |

> 暂不支持 Linux。HarmonyOS 编译构建、模拟器与真机调试依赖 [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/)，且目前仅提供 Windows 与 macOS 版本。

## 推荐配置

**操作系统**

- **Windows**：Windows 11 22H2 及以上
- **macOS**：macOS 15 Sequoia 及以上

**硬件**

- **日常使用**（短会话、单模块改动、以对话与代码编辑为主）：8 GB 及以上内存
- **重度使用**（大工程、长会话、频繁编译构建与模拟器/真机调试）：16 GB 及以上内存；建议为 DevEco Studio、SDK、模拟器与构建缓存预留 20 GB 及以上可用磁盘空间

**运行时与工具链**

- [Node.js](https://nodejs.org) **22 及以上**
- [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/) **6.1 及以上**（编译构建、Hvigor、HDC、模拟器/真机运行）
- 已配置 `DEVECO_HOME` 环境变量，指向 DevEco Studio 安装目录

**终端 Shell**

- Windows：PowerShell 7+（推荐）、PowerShell 5.1+
- macOS：Zsh（推荐）、Bash

**网络**

- 需要稳定的互联网连接（华为账号登录、模型调用、HarmonyOS 知识库检索等）

## 安装前置

DevEco Code 通过 npm 分发，安装前请先准备以下环境：

1. 安装 [Node.js](https://nodejs.org)，**推荐使用 22 及更高版本**
2. （可选）安装 [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/)，**推荐使用 6.1 及更高版本**；若不安装，HarmonyOS 应用构建、推包等工具将无法使用
3. （可选）配置 `DEVECO_HOME` 环境变量指向 DevEco Studio 安装目录，默认路径示例：
   - **macOS**：`/Applications/DevEco-Studio.app`
   - **Windows**：`C:\Program Files\Huawei\DevEco Studio`

可先在终端验证 Node.js 环境：

```bash
node -v
npm -v
```

## 安装与卸载

安装：

```bash
npm install -g @deveco/deveco-code
```

查看版本、启动：

```bash
deveco --version
deveco
```

更新：

```bash
deveco upgrade
```

卸载运行时数据与全局包：

```bash
deveco uninstall
npm uninstall -g @deveco/deveco-code
```

## 登录与登出

使用 DevEco Code 需先通过华为账号登录。首次执行 `deveco` 时会在终端内引导完成登录；也可单独执行登录命令：

```bash
deveco auth login
```

登出会清除当前华为账号的本地登录状态，下次启动需重新登录。执行：

```bash
deveco auth logout
```

## 模型配置

登录后可使用 DevEco Code 提供的免费模型通道。

在 DevEco Code 中输入 `/models` 可进入模型配置界面。当前免费提供 `GLM-5.1` 模型，单账号默认每分钟 50 次请求。也可以通过 `Ctrl+A` 进入 Provider 选择界面，配置支持的第三方模型。

也可以通过 `deveco.jsonc` 配置模型：

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

**UI 检查配置**

UI 检查是功能验证阶段的可选能力，用于验证界面是否符合需求描述。

该功能需调用多模态模型：已登录账号时默认使用内置 Qwen3-VL 模型，未登录时则跳过UI检查。

如需配置第三方多模态模型（仅支持 Qwen 系列），可在 `deveco.jsonc` 的 `agent` 中指定，以qwen3-vl-plus为例：

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
      "model": "myprovider/qwen3-vl-plus", // 格式为<provider-name>/<model-name>
      "hidden": true,
    },
  },
}
```

配置文件读取优先级：

1. 项目目录下 `.deveco/deveco.jsonc`
2. 项目目录下 `deveco.jsonc`
3. 用户目录下 `.config/deveco/deveco.jsonc`

## Agent 配置

DevEco Code 面向 HarmonyOS 开发提供以下 Agent 配置（按 `Tab` 键切换）：

- `Build`：默认模式，适合工程生成、代码生成、配置修正、测试执行、推包运行和发布执行
- `Plan`：适合需求拆解、技术方案、发布规划、测试规划和文档生成
- `Goal`：适合 SDD 五阶段从需求到实现与构建验证的端到端特性交付

## HarmonyOS 场景能力

DevEco Code 集成了常用 HarmonyOS 开发工具能力：

| 工具                       | 说明                   |
| ------------------------ | -------------------- |
| `build_project`          | 执行编译构建并导出构建产物        |
| `start_app`              | 在模拟器或真机上运行应用         |
| `hdc_log`                | 收集/清理设备日志/查看连接模拟器    |
| `verify_ui`              | 执行 UI 操作验证功能是否正确        |
| `check_ets_files`        | ArkTS 静态语法检查         |
| `arkts_knowledge_search` | HarmonyOS 知识搜索 |
| `switch_cwd`             | 切换构建项目路径             |

常见场景包括：从零到一创建 HarmonyOS 工程、增量开发页面、修复编译报错、真机调试。

## 扩展能力

DevEco Code 兼容 OpenCode 的 Skill、MCP 和 Plugin 扩展方式。

> 新增或修改 Skill、MCP、Plugin 配置后，需退出并重新执行 `deveco` 启动后才会生效。

### Skills

```bash
npx skills add vercel-labs/agent-skills
```

也可以把 Skill 放到 `~/.config/deveco/skills` 目录。

### MCP

可在 `~/.config/deveco/deveco.jsonc` 中配置 MCP：

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

然后在 `deveco.jsonc` 中配置插件入口：

```jsonc
{
  "plugin": [
    "node_modules/oh-my-opencode/dist/index.js"
  ]
}
```

## 从 OpenCode 迁移

如果需要从 OpenCode 迁移到 DevEco Code，请将配置文件迁移到 DevEco Code 目录。主配置文件可参考：

```powershell
# Windows PowerShell
Copy-Item -Force "{源路径}\opencode.jsonc" "~\.config\deveco\deveco.jsonc"
```

```bash
# macOS
cp {源路径}/opencode.jsonc ~/.config/deveco/deveco.jsonc
```

Skills、Agents、Plugins 也可以迁移到 `~/.config/deveco` 下的对应目录；MCP 配置项可迁移到 `deveco.jsonc` 中。

## 参与贡献

欢迎贡献！请在提交 Pull Request 前阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 帮助与支持

- 常见问题请参阅 [FAQ 文档](https://gitcode.com/openharmony-sig/deveco-code/wiki/FAQ.md)
- 终端常用命令（如 `/models`、`/connect` 等）请参阅 [OpenCode TUI 文档](https://opencode.ai/docs/zh-cn/tui/)
- 反馈与交流 [GitCode Issue](https://gitcode.com/openharmony-sig/deveco-code/issues)

## 开源许可

[MIT License](LICENSE)

## 基于 OpenCode 构建的声明

本项目基于开源项目 [OpenCode](https://opencode.ai) 扩展开发。DevEco Code **并非** OpenCode 团队出品，也与 OpenCode 团队无任何附属或关联关系。如有与 DevEco Code 相关的问题，请通过 [GitCode Issue](https://gitcode.com/openharmony-sig/deveco-code/issues) 反馈，而非联系 OpenCode 社区。
