<p align="center">
  <a href="https://www.npmjs.com/package/@codegenie-ai/codegenie-cli">
    <img src="packages/console/app/src/asset/codegenie-logo.jpg" alt="CodeGenie logo" width="420">
  </a>
</p>
<p align="center">面向 HarmonyOS（鸿蒙）开发场景的 AI CLI 助手。</p>
<p align="center">
  <a href="https://www.npmjs.com/package/@codegenie-ai/codegenie-cli"><img alt="npm" src="https://img.shields.io/npm/v/%40codegenie-ai%2Fcodegenie-cli?style=flat-square" /></a>
  <a href="https://developer.huawei.com/consumer/cn/deveco-studio/"><img alt="DevEco Studio" src="https://img.shields.io/badge/DevEco%20Studio-required-blue?style=flat-square" /></a>
  <a href="https://opencode.ai"><img alt="Based on OpenCode" src="https://img.shields.io/badge/based%20on-OpenCode-black?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a>
</p>

[![CodeGenie Terminal UI](packages/web/src/assets/lander/codegenie-terminal-ui.jpg)](https://www.npmjs.com/package/@codegenie-ai/codegenie-cli)

---

### 简介

CodeGenie CLI 是一款面向 HarmonyOS（鸿蒙）开发场景的 AI CLI 助手，支持代码编写、编译构建、设备运行、文档查阅、运行时调试和 ArkTS 问题修复等能力。

CodeGenie 基于开源项目 [OpenCode](https://opencode.ai) 扩展开发，保留了 OpenCode 的终端交互、配置体系、Provider / MCP / Skill / Plugin 等能力，并针对鸿蒙工程增加了 DevEco Studio、hvigorw、hdc、ArkTS 检查和设备调试相关集成。

### 安装

#### 系统要求

| 平台 | 支持情况 |
| --- | --- |
| Windows x64 | 支持 |
| macOS Apple Silicon（M 系列芯片） | 支持 |
| macOS Intel（x64） | 支持 |

#### 安装前置依赖

CodeGenie 通过 npm 分发，需要先安装 [Node.js LTS](https://nodejs.org)。安装完成后可在终端验证：

```bash
node -v
npm -v
```

如需使用鸿蒙工程的编译、运行和调试能力，还需要安装 [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/)，并配置 `DEVECO_HOME` 环境变量指向 DevEco Studio 安装目录。

#### 安装 / 更新 / 卸载

```bash
# 安装
npm install -g @codegenie-ai/codegenie-cli --registry=https://registry.npmjs.org

# 查看版本
codegenie --version

# 启动
codegenie

# 更新
codegenie upgrade

# 卸载运行时数据
codegenie uninstall

# 卸载 npm 全局包
npm uninstall -g @codegenie-ai/codegenie-cli
```

> [!TIP]
> macOS 如果遇到全局安装权限问题，可以使用 `sudo -i npm install -g @codegenie-ai/codegenie-cli --registry=https://registry.npmjs.org`。

### 登录与模型

启动 `codegenie` 后可使用华为账号登录。登录后可使用 CodeGenie 提供的免费模型通道；不登录时也可以沿用 OpenCode 的 Provider 配置体系，自行配置模型。

```bash
# 退出登录
codegenie auth logout
```

在 CodeGenie 中输入 `/models` 可进入模型配置界面。当前免费提供 `glm-5`、`deepseek-v3.2` 两款模型，单账号默认每分钟 50 次请求。也可以通过 `Ctrl+A` 进入 Provider 选择界面，配置智谱、阿里等 OpenAI-compatible 模型。

也可以通过 `codegenie.jsonc` 配置模型：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "codegenie": {
      "name": "CodeGenie",
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
        "apiKey": "{env:CODEGENIE_API_KEY}"
      }
    }
  }
}
```

配置文件读取优先级：

1. 项目目录下 `.codegenie/codegenie.jsonc`
2. 项目目录下 `codegenie.jsonc`
3. 用户目录下 `.config/codegenie/codegenie.jsonc`

### Agents

CodeGenie 面向鸿蒙开发提供以下 Agent 模式：

- **build** - 默认模式，适合工程生成、代码生成、配置修正、测试执行、推包运行和发布执行。
- **plan** - 适合需求拆解、技术方案、发布规划、测试规划和文档生成。

另外还包含一个 **general** 子 Agent，用于复杂搜索和多步任务，内部使用，也可在消息中输入 `@general` 调用。

### 鸿蒙场景能力

CodeGenie 集成了常用鸿蒙开发工具能力：

| 工具 | 说明 |
| --- | --- |
| `build_project` | 执行编译构建并导出构建产物 |
| `start_app` | 在模拟器或真机上运行应用 |
| `runtime-calibration` | UI 自动化测试，可通过设置启用 |
| `runtime-calibration_getLog` | 获取设备运行日志，可通过设置启用 |
| `execute_uitest` | UI 测试操作，包括点击、滑动、输入、按键、截图等 |
| `hdc_log` | 收集或清理设备日志 |
| `check_ets_files` | ArkTS 静态语法检查 |

常见场景包括：从 0 到 1 创建鸿蒙工程、增量开发页面、修复编译报错、真机调试，以及基于多模态模型的图生文界面生成。

### 扩展能力

CodeGenie 兼容 OpenCode 的 Skill、MCP 和 Plugin 扩展方式。

#### Skills

```bash
# 安装社区 Skill
npx skills add vercel-labs/agent-skills
```

也可以把 Skill 放到 `~/.config/codegenie/skills`，重启 CodeGenie 后加载。

#### MCP

可在 `~/.config/codegenie/codegenie.jsonc` 中配置 MCP：

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

#### Plugins

```bash
npm install -g oh-my-opencode
```

然后在 `codegenie.jsonc` 中配置插件入口：

```jsonc
{
  "plugin": [
    "file:///C:/Users/tylor/AppData/Roaming/npm/node_modules/oh-my-opencode/dist/index.js"
  ]
}
```

### 从 OpenCode 迁移

如果需要从 OpenCode 迁移到 CodeGenie，请将配置文件迁移到 CodeGenie 目录。主配置文件可参考：

```powershell
# Windows PowerShell
Copy-Item -Force "{源路径}\opencode.jsonc" "~\.config\codegenie\codegenie.jsonc"
```

```bash
# macOS
cp {源路径}/opencode.jsonc ~/.config/codegenie/codegenie.jsonc
```

Skills、Agents、Plugins 也可以迁移到 `~/.config/codegenie` 下的对应目录；MCP 配置项可迁移到 `codegenie.jsonc` 中。

### 常见问题 (FAQ)

#### 这和 OpenCode 有什么关系？

CodeGenie 基于 OpenCode 扩展开发，保留其终端 UI、Provider、MCP、Skill、Plugin 和配置体系，并额外针对 HarmonyOS 开发链路加入编译构建、设备运行、日志采集、ArkTS 检查和运行时调试等能力。
