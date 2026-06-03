# DevEco Code 使用文档

面向 HarmonyOS（鸿蒙）开发场景的 AI Agent 工具 — 代码编写 · 编译构建 · 设备运行 · 运行时调试

---

## 推荐系统配置

- **操作系统：**
  - Windows x64（推荐 Windows 11）
  - macOS Apple Silicon（M 系列）
  - macOS Intel（x64）
- **前置依赖：**
  - [Node.js](https://nodejs.org) **22+**
  - [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/) **6.1+**
- **环境变量：** 设置 `DEVECO_HOME` 指向 DevEco Studio 安装目录
- **Shell：** Bash、Zsh、PowerShell 或 Windows Terminal
- **网络：** 需要网络连接

## 快速开始

### 一键安装

> **推荐使用npm官方或淘宝镜像源**

```bash
npm install -g @deveco/deveco-code
```

### 配置环境变量

设置 `DEVECO_HOME` 并将工具链加入 PATH。

**macOS：**

```bash
# 添加至 ~/.zshrc 或 ~/.bashrc
export DEVECO_HOME="/Applications/DevEco-Studio.app/Contents"
export PATH="$DEVECO_HOME/sdk/default/openharmony/toolchains:$PATH"
```

**Windows：**

```powershell
# 系统环境变量中新建 DEVECO_HOME，指向 DevEco Studio 安装路径
# 编辑 PATH，追加 %DEVECO_HOME%\sdk\default\openharmony\toolchains
```

### 更新与卸载

**更新：**

```bash
deveco upgrade
```

**卸载：**

```bash
deveco uninstall
# 或
npm uninstall -g @deveco/deveco-code
```

## 启动与登录

在终端中执行以下命令启动 DevEco Code：

```bash
deveco
```

首次启动后，使用华为账号登录即可开始使用。登录成功后可免费使用内置模型。

退出登录：

```bash
deveco auth logout
```

## HarmonyOS 开发能力

### Agent 模式

在 DevEco Code 中输入 `/agents` 可查看所有可用的 Agent 模式，按下 `Tab` 键可在不同模式之间快速切换。

| 模式 | 说明 |
|------|------|
| **Build** *(默认)* | 工程生成、代码生成、配置修正、测试执行、推包运行、发布执行 |
| **Plan** | 需求拆解、技术方案、发布规划、测试规划、文档生成 |
| **Goal** | 适合 `spec` 定义、规范驱动、代码生成和功能验证 |

### 开发工具

| 工具 | 说明 |
|------|------|
| `build_project` | 执行编译构建并导出构建产物 |
| `start_app` | 在模拟器/真机上运行应用 |
| `hdc_log` | 收集/清理设备日志、查看已连接模拟器 |
| `verify_ui` | 执行 UI 操作验证功能是否正确 |
| `check_ets_files` | ArkTS 静态语法检查 |
| `arkts_knowledge_search` | HarmonyOS 知识搜索 |
| `switch_cwd` | 切换构建项目路径 |

### 内置 Skill

| Skill | 说明 | 适用场景 |
|-------|------|----------|
| **arkui-knowledge** | ArkUI 声明式语法最佳实践指南 | ArkUI 界面开发 |
| **arkts-grammar-standards** | ArkTS 语法规则及 TypeScript 迁移差异参考 | ArkTS 语法规范 |
| **arkts-error-fixes** | 编译与类型错误快速查询 | 快速调试 |
| **deveco-create-project** | 快速创建标准化 HarmonyOS 模板工程 | 项目初始化 |
| **arkts-runtime-fix** | 运行时常见问题修复方案 | 稳定性保障 |

### 典型应用场景

| 场景 | 说明 |
|------|------|
| **创建新工程** | 根据需求描述自动生成完整的 HarmonyOS 应用工程 |
| **增量开发** | 基于已有工程新增功能、页面、Tab 切换等 |
| **编译错误修复** | 自动分析编译错误并生成修复方案 |
| **真机调试** | 在 DevEco Studio 完成签名配置后，支持真机部署与调试 |
| **设计稿生成代码** | 配置多模态模型后，可基于设计稿图片自动生成界面代码 |

## Goal 模式

Goal 模式包含 **5 个阶段**：需求分析 → 架构设计 → 任务分解 → 代码实现 → 功能验证。

执行过程中在当前工程下新建 `.specs/` 目录，每个需求依次生成 `spec.md`、`plan.md`、`tasks.md`。

### 切换模式

按下 `Tab` 键可切换至 Goal 模式。

### 模拟器 / 真机配置

功能验证阶段需要配置模拟器或连接真机设备。参考 [创建模拟器](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-emulator-create)。

> ️未配置模拟器或真机设备时，功能验证阶段仅执行编译验证。连接真机需确保工程已完成签名配置。

### UI 检查配置

功能验证阶段如需检查 UI，设置环境变量 `ADDITIONAL_TOOL_GROUPS=ui_integration_test`。

**macOS / Linux：**

```bash
# 添加到 Shell 配置文件（如 ~/.zshrc、~/.bashrc）
export ADDITIONAL_TOOL_GROUPS=ui_integration_test
```

**Windows：**

```powershell
# 系统设置 → 环境变量 → 新增用户变量
ADDITIONAL_TOOL_GROUPS=ui_integration_test
```

<details>
<summary>多模态模型配置（UI 检查）</summary>

- **已登录**：默认使用内置 Qwen2.5-VL
- **未登录**：跳过 UI 检查
- **自定义**：在 `deveco.jsonc` 配置（仅支持 Qwen 系列）

```jsonc
{
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "alibaba",
      "options": {
        "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "apiKey": "xxxxxxxxxxxxx"
      },
      "models": {
        "qwen3.5-flash": {
          "tool_call": true,
          "limit": { "context": 128000, "output": 4096 },
          "modalities": { "input": ["text", "image"], "output": ["text"] }
        }
      }
    }
  },
  "agent": {
    "ui_verification": {
      "mode": "subagent",
      "model": "myprovider/qwen3.5-flash",
      "hidden": true
    }
  }
}
```

</details>

## 模型配置

在 DevEco Code 中输入 `/models` 进入模型配置界面。

### 使用免费模型

当前免费提供 **GLM-5.1** 模型，登录后即可使用，无需额外配置。

### 通过 Provider 配置

在模型选择页面按 `Ctrl+A` 进入 Provider 界面，选择提供商、输入 API Key、选择模型。

### 通过配置文件

编辑 `~/.config/deveco/deveco.jsonc`（不存在则新建）。

> **配置读取优先级：** `.deveco/deveco.jsonc` > 项目目录 `deveco.jsonc` > `~/.config/deveco/deveco.jsonc`

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "deveco": {
      "name": "DevEco Code",
      "models": {
        "glm-5": {
          "tool_call": true,
          "limit": { "context": 200000, "output": 8192 }
        }
      },
      "options": {
        "baseURL": "https://cn.devecostudio.huawei.com/sse/DevEcoCode/maas/v2",
        "apiKey": "{env:DEVECO_API_KEY}"
      }
    }
  }
}
```

### 配置多模态模型

多模态模型支持图片输入，可通过以下方式配置：

- **界面配置**：`/models` → `Ctrl+A` → 选择提供商（如 ZhipuAI、Alibaba）→ 输入 API Key → 选择支持图片的模型
- **配置文件**：在 `deveco.jsonc` 的 provider 中新增带 `modalities` 字段的模型配置

<details>
<summary>多模态模型配置文件示例</summary>

```jsonc
{
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "alibaba",
      "options": {
        "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "apiKey": "xxxxxxxxxxxxxxxxxxx"
      },
      "models": {
        "qwen3.6-plus": {
          "tool_call": true,
          "limit": { "context": 200000, "output": 8192 },
          "modalities": {
            "input": ["text", "image"],
            "output": ["text"]
          }
        }
      }
    }
  }
}
```

</details>

## 常用配置

### 配置绿灯模式

启用后，所有工具调用将自动执行，无需逐次确认：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": "allow"
}
```

### 生成 AGENTS.md

`AGENTS.md` 是工程级别的上下文描述文件，用于辅助 AI 理解项目结构与开发规范。建议在开始开发前生成该文件，DevEco Code 将自动加载并用于提升代码生成的准确性与效率。

## Skill / MCP / 插件

| 类型 | 说明 | 配置方式 |
|------|------|----------|
| **Skill** | 全局技能定义，支持目录放置、npx 安装、自定义创建 | `~/.config/deveco/skills/` |
| **MCP** | 外部工具集成协议，连接浏览器、数据库等第三方服务 | `deveco.jsonc` |
| **插件** | 社区插件扩展，如 Oh My OpenAgent | `npm install -g` + `deveco.jsonc` |

### Skill 安装详情

**方式一：目录放置**

将 Skill 文件放入 `~/.config/deveco/skills/`，重启后生效。

**方式二：npx 安装**

```bash
npx skills add vercel-labs/agent-skills
```

安装后存储在 `~/.agents/skills/` 目录。

**方式三：使用 skill-creator**

在 DevEco Code 内使用内置 `skill-creator` 创建自定义 Skill。

### MCP 配置示例（Playwright）

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

### 插件配置示例（Oh My OpenAgent）

```bash
npm install -g oh-my-openagent
```

在 `deveco.jsonc` 中配置插件入口文件路径：

```jsonc
{
  "plugin": [
    "<插件入口文件的绝对路径>"
  ]
}
```

## 自定义命令

支持 JSON 配置和 Markdown 文件两种方式定义自定义命令。

| 方式 | 说明 |
|------|------|
| **JSON** | 在 `deveco.jsonc` 的 `command` 字段中定义命令名、模板、描述、agent 和 model |
| **Markdown** | 在 `~/.config/deveco/commands/` 或 `.deveco/commands/` 放置 .md 文件，文件名即命令名 |

<details>
<summary>JSON 命令配置示例</summary>

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "command": {
    "test": {
      "template": "Run the full test suite with coverage report...",
      "description": "Run tests with coverage",
      "agent": "build",
      "model": "anthropic/claude-3-5-sonnet-20241022"
    }
  }
}
```

在 TUI 中运行：`/test`

</details>

## 从 OpenCode 迁移至 DevEco Code

按照以下对照表，将 OpenCode 配置迁移至 DevEco Code。

> 以下路径均相对于 DevEco Code 配置目录（默认为 `~/.config/deveco/`）

| 内容 | 迁移目标路径 | 支持 deveco.jsonc |
|------|-------------|:-:|
| **Skills** | `skills/` | ✔ |
| **Agents** | `agents/` | ✔ |
| **Plugins** | `plugins/` | ✔ |
| **MCP** | 在 `deveco.jsonc` 中配置 | ✔ |
| **主配置** | `deveco.jsonc` | — |

<details>
<summary>迁移命令示例</summary>

**Skills：**

```bash
cp -r {源路径}/skills/* ~/.config/deveco/skills/
```

**Agents：**

```bash
cp -r {源路径}/agents/* ~/.config/deveco/agents/
```

**Plugins：**

```bash
cp -r {源路径}/plugins/* ~/.config/deveco/plugins/
```

**主配置：**

```bash
cp {源路径}/opencode.jsonc ~/.config/deveco/deveco.jsonc
```

</details>

## 推荐配置

- 登录华为账号后可免费使用内置模型，无需额外配置 API Key。
- 推荐使用 **build 模式**执行日常开发任务，以获得最佳体验。
- 开始开发前建议先生成 **AGENTS.md**，以提升 AI 对项目的理解能力。
- **设计稿生成代码**等功能需在 provider 中配置支持 `image` 输入的多模态模型。
- **真机调试**需在 DevEco Studio 中预先完成应用签名配置。
- **Windows 用户**推荐使用 PowerShell 或 Windows Terminal，避免终端兼容性问题。

## FAQ

<details>
<summary>1. DevEco Studio Terminal 交互异常</summary>

**原因**：JetBrains Terminal 组件存在鼠标灵敏度与滚动条交互的兼容性问题。

**解决方案**：使用 Windows Terminal 运行 DevEco Code。

</details>

<details>
<summary>2. 生成 nul 等异常文件</summary>

**原因**：AI 生成命令中包含无效路径时，可能创建非常规命名的文件。

**解决方案**：使用 Git Bash 删除该文件。建议使用 CMD 运行 DevEco Code。

</details>

<details>
<summary>3. Windows 10 全屏闪退</summary>

**原因**：`conhost.exe` 处理 VT 序列时存在已知缺陷，全屏操作可能触发缓冲区溢出。

**解决方案**：安装 [Windows Terminal](https://apps.microsoft.com/detail/9N0DX20HK701)（Microsoft Store 免费下载）。

</details>

<details>
<summary>4. Export 功能编码问题</summary>

**原因**：PowerShell 的 `>` 重定向默认使用 UTF-16 LE 编码，而 Import 使用 UTF-8。

**解决方案**：使用 CMD 执行导出和导入：

```bash
deveco export > session.json
deveco import session.json
```

</details>
