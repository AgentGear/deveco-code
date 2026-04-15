# CodeGenie 架构指南

> 本文档面向所有 AI 编码助手和开发者，定义了 CodeGenie 项目的技术架构和扩展规范。
> 在修改任何代码之前，**必须先阅读本文档**。

---

## 四大原则

### 原则一：先调查，再动手

在实现任何功能之前，**必须先详尽调查该功能在 OpenCode 上的原生架构与实现**。

- 阅读 `packages/opencode` 中相关的源码，理解现有实现的设计意图
- 查找是否已有类似的抽象、接口或工具函数可直接复用
- 检查 `specs/` 目录下是否有相关的历史设计文档和源码修改记录
- 确认现有的类型定义（`type`、`interface`、`zod schema`），不要重新定义已有的类型

**禁止**：在不了解现有架构的情况下直接开始编写新代码。

### 原则二：优先使用原生扩展机制，不侵入源码

调查完成后，在设计方案时**尽量不要侵入 OpenCode 的源码**。

按以下顺序决策：

1. **配置层**（零代码）— 能否通过 `codegenie.json`、`.codegenie/` 配置解决？适用于：添加 Provider、定义 Agent、权限控制等
2. **MCP Server**（外部进程，任意语言）— 能否通过添加 MCP Server 提供工具/资源/提示词？进程隔离，不影响主进程稳定性
3. **Skills**（零代码）— 能否通过结构化提示词（`SKILL.md`）注入领域能力？支持从远程 URL 加载
4. **Plugin Hook**（新文件）— 能否通过 `packages/plugin` 的 Hooks 接口扩展？适用于：拦截聊天消息、自定义认证、修改 LLM 参数、添加自定义 Tool、Event Bus 事件订阅等
5. **新增包** — 能否通过新增 `packages/<name>` 以组合方式扩展核心？参考 `enterprise`、`slack` 的模式
6. **侵入修改** — 以上均不可行时，才修改 OpenCode 源码（见原则三），且必须在方案中写明为何以上方式均不可行

#### 可用的原生扩展点

**1. 配置层**（`codegenie.json` / `.codegenie/`）：

| 机制 | 路径 | 用途 |
|------|------|------|
| Agents | `.codegenie/agents/` | 定义 AI 行为和提示词 |
| Commands | `.codegenie/commands/` | 定义可复用命令模板（Markdown） |
| Plugins | 配置 `plugins` 字段 | 加载 npm 包或本地插件 |
| MCP Servers | 配置 `mcp` 字段 | 添加远程/本地 MCP 服务 |
| LSP | 配置 `lsp` 字段 | 添加语言服务器支持 |
| Skills | 配置 `skills` 字段 | 添加技能路径和远程技能 |
| Provider | 配置 `provider` 字段 | 添加新 AI 服务商（或通过 `models.dev`） |
| Keybinds | 配置 `keybinds` 字段 | 自定义快捷键 |
| Permissions | 配置 `permissions` 字段 | 访问控制规则 |
| Managed Config | 企业级配置下发 | 组织统一管理（最高优先级） |

**2. MCP Server** — 通过 `codegenie.json` 的 `mcp` 字段添加，进程隔离，支持任意语言：

```jsonc
{ "mcp": { "my-server": { "type": "local", "command": ["node", "./mcp-server.js"] } } }
```

**3. Skills** — 通过 `skills` 字段配置本地或远程结构化提示词，注入领域能力：

```jsonc
{ "skills": { "paths": [".codegenie/skills"], "urls": ["https://example.com/.well-known/skills/"] } }
```

**4. Plugin Hooks**（`packages/plugin`）— 需要运行时逻辑时使用：

```typescript
interface Hooks {
  "event"?: (input, { event }) => Promise<void>
  "config"?: (input: Config) => Promise<void>
  "tool"?: { [key: string]: ToolDefinition }        // 添加自定义工具
  "auth"?: AuthHook                                   // 自定义认证
  "tool.definition"?: (input, output) => Promise<void> // 修改工具描述/参数
  "shell.env"?: (input, output) => Promise<void>       // 注入 shell 环境变量
  "chat.message"?: (input, output) => Promise<void>    // 拦截/修改聊天消息
  "chat.params"?: (input, output) => Promise<void>     // 修改 LLM 请求参数
  "chat.headers"?: (input, output) => Promise<void>    // 修改 LLM 请求 headers
  "permission.ask"?: (input, output) => Promise<void>  // 自定义权限逻辑
  "command.execute.before"?: (input, output) => Promise<void>
  "tool.execute.before"?: (input, output) => Promise<void>
  "tool.execute.after"?: (input, output) => Promise<void>
  // experimental hooks
  "experimental.chat.system.transform"?: ...  // 修改 system prompt
  "experimental.chat.messages.transform"?: ... // 修改消息列表
  "experimental.session.compacting"?: ...      // 自定义会话压缩
  "experimental.text.complete"?: ...           // 拦截文本补全
}
```

工具注册示例：

```typescript
import { tool } from "@opencode/plugin"

export default tool({
  description: "工具描述",
  args: { /* zod schema */ },
  execute: async (args, ctx) => {
    // 实现逻辑
    return "result"
  }
})
```

**5. 新增包** — 在 `packages/` 下新增独立包，以组合方式扩展核心。参考 `enterprise`、`slack` 的模式。

### 原则三：侵入修改必须基于架构，不可零散修改

当确认必须修改 OpenCode 源码时，遵循以下策略：

1. **基于已有架构模式实现** — 沿用项目现有的抽象层次、命名风格和代码组织方式
2. **修改点集中化** — 将修改集中在尽可能少的文件中，避免"撒胡椒面"式的大量散落修改
3. **遵循现有模式** — 如果项目中已有类似功能的实现方式，保持一致
4. **保持向后兼容** — 不删除或重命名已有的公开 API（导出函数、数据库列名、配置字段）

**错误示例**：在 5 个不同的文件中各加 2-3 行来完成一个功能。

**正确示例**：在一个新增文件中集中实现，仅在入口处添加 1-2 行注册代码。

### 原则四：修改代码后必须同步更新文档

- **新增侵入修改** — 必须在 `specs/<feature-name>/source-code-changes.md` 中记录，格式遵循 `specs/constitution.md`，实施前参考 `specs/codegenie-auth/source-code-changes.md` 保持风格一致
- **修改已有功能**（bugfix、重构、需求变更）— 必须同步更新该功能对应的 `specs/` 目录下的所有相关文档（需求分析、功能设计、source-code-changes 等），确保文档与代码一致
- **记录时需说明**：每处修改的原因、为什么不能通过扩展机制实现、以及该修改对上游同步的影响评估

---

## 项目架构概览

### Monorepo 结构

```
codegenie-cli/
├── packages/
│   ├── opencode/        # 核心 CLI 应用（主入口）
│   ├── plugin/          # 插件系统接口定义
│   ├── enterprise/      # 企业级扩展功能
│   ├── app/             # Web 前端（SolidJS）
│   ├── web/             # Web 服务器（HTTP/WebSocket）
│   ├── desktop/         # 桌面应用（Tauri）
│   ├── sdk/             # JavaScript SDK（公开接口）
│   ├── ui/              # 共享 UI 组件库
│   ├── util/            # 共享工具库
│   ├── console/         # 管理控制台
│   ├── function/        # 函数执行引擎
│   ├── script/          # 脚本执行
│   └── slack/           # Slack 集成
├── specs/               # 功能规格与源码修改记录
├── AGENTS.md            # AI 编码风格约束（上游同步）
└── ARCHITECTURE.md      # 本文件 - 架构指南
```

### 核心依赖关系

```
                    ┌──────────┐
                    │ opencode │  核心入口
                    └────┬─────┘
              ┌──────────┼──────────┐
              ▼          ▼          ▼
           plugin      sdk        ui
              │          │          │
              ▼          ▼          ▼
          enterprise   web       util
                        │
                   ┌────┼────┐
                   ▼    ▼    ▼
                 app  desktop  console
```

### 配置加载优先级（低 → 高）

1. 远程 `.well-known/opencode`（组织默认值）
2. 全局配置 `~/.config/codegenie/`
3. 自定义路径 `CODEGENIE_CONFIG` 环境变量
4. 项目配置 `codegenie.json`
5. `.codegenie/` 目录（agents、commands、plugins）
6. 内联配置 `CODEGENIE_CONFIG_CONTENT`
7. 托管配置（企业管理员下发）

### 入口文件

| 平台 | 入口 |
|------|------|
| CLI | `packages/opencode/src/index.ts` |
| Web 前端 | `packages/app/src/index.ts` |
| Web 服务 | `packages/web/src/` |
| 桌面应用 | `packages/desktop/src/` |

### 技术栈

- **运行时**: Bun
- **语言**: TypeScript (ES Modules)
- **前端框架**: SolidJS
- **后端框架**: Hono
- **ORM**: Drizzle ORM
- **AI SDK**: Vercel AI SDK
- **桌面**: Tauri
- **数据库**: SQLite
- **构建**: Turbo
