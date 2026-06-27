# Custom Features Verification Checklist

> 每次同步后（Step 7 / Step 9）逐项确认。所有条目都是 DevEco Code 独有功能，上游不存在。
>
> **重要**：下方的代码片段仅为历史参考实现，并非要求严格照搬。上游可能大规模重构代码架构（如重命名、迁移模块、改变初始化模式），Agent 应根据同步后实际的代码架构来判断每个功能是否正确保留。检查项描述的是**功能意图**，而非具体代码形式。

## 1. registry.ts — HarmonyOS 自定义工具 + Plan 工具

文件：`packages/opencode/src/tool/registry.ts`

- [ ] **Imports** 存在：`HdcLogTool` from `"./hdc_log"`, `SwitchCwdTool` from `"./switch-cwd"`, `OhKnowledgeTool` from `"./oh_knowledge"`, `Auth` from `"@/auth"`, `PlanWriteTool` 和 `PlanEnterTool` from `"./plan"`（与 `PlanExitTool` 同在）
- [ ] **Layer 依赖**：`Auth.Service` 在 `Layer.Layer` 类型联合中
- [ ] **初始化**：`yield* HdcLogTool`, `yield* SwitchCwdTool`, `yield* OhKnowledgeTool`, `yield* PlanWriteTool`, `yield* PlanEnterTool`, `yield* Auth.Service`
- [ ] **Tool.init()**：`hdclog`, `switchcwd`, `ohknowledge`, `planwrite`, `planenter` 在 `Effect.all` 块中
- [ ] **ohknowledge OAuth 门控**：ohknowledge 工具仅在用户通过 deveco OAuth 认证时注册到 Builtin 列表，未认证用户不应看到该工具。参考实现：
  ```ts
  const authInfo = yield* auth.get("deveco").pipe(Effect.orElseSucceed(() => undefined))
  const ohknowledgeEnabled = authInfo !== undefined && authInfo.type === "oauth"
  ```
  Builtin 列表中使用 `...(ohknowledgeEnabled ? [tool.ohknowledge] : [])` 条件展开（参考提交 `fee1ab5e`）
- [ ] **Builtin 列表**：`tool.hdclog`, `tool.switchcwd`, `...(ohknowledgeEnabled ? [tool.ohknowledge] : [])`（带 `// HarmonyOS tools` 注释）；`tool.planwrite`, `tool.planenter` 与 `tool.plan` 同在 `flags.client === "cli"` 条件下（**不含** `experimentalPlanMode`）
- [ ] **defaultLayer**：`Layer.provide(Auth.defaultLayer)` 在 provider chain 中

参考提交：`6067f5a6`（Agent 权限设定）、`fee1ab5e`（ohknowledge OAuth 门控）

## 2. agent.ts — Agent 权限配置

文件：`packages/opencode/src/agent/agent.ts`

- [ ] **build agent**: `plan_enter: "ask"`, `plan_write: "deny"`（上游默认 `"allow"` / 缺失）
- [ ] **plan agent**: `plan_exit: "ask"`, `plan_write: "allow"`, `edit: "deny"`, 以及 9 个 HarmonyOS 工具 deny 规则：`bash`, `build_project`, `arkts_check`, `perform_ui_action`, `get_app_ui_tree`, `start_app`, `hdc_log`, `switch_cwd`, `arkts_knowledge_search`

## 3. package.json — 自定义依赖

文件：`packages/opencode/package.json`

- [ ] **name**：`"deveco"`（非 `"opencode"`）
- [ ] **bin**：`{ "deveco": "./bin/deveco" }`（非 `"opencode"`）
- [ ] **devDependencies** 中（按字典序）：`@deveco-codegenie/mcp-bridge`, `@deveco-codegenie/mcp-bridge-darwin-arm64`, `@deveco-codegenie/mcp-bridge-darwin-x64`, `@deveco-codegenie/mcp-bridge-win32-x64`
- [ ] **dependencies** 中同上 4 包
- [ ] **workspace dep**（`packages/web/package.json`）：`"deveco": "workspace:*"`（非 `"opencode"`）

参考提交：`456483d2c`（首次添加）、`2d4aac556`（v1.14.50→v1.14.51 再次丢失）

## 4. skill/index.ts — Default skills 提取

文件：`packages/opencode/src/skill/`

- [ ] `defaults.ts` 文件存在，`DEVECO_DEFAULT_SKILLS` declare 正确
- [ ] `index.ts` 中 `import { Defaults } from "./defaults"` 存在
- [ ] `index.ts` 中 `import { InstallationVersion } from "@opencode-ai/core/installation/version"` 存在
- [ ] `discoverSkills` 函数体开头有：
  ```ts
  const defaultDir = yield* Defaults.ensure(InstallationVersion, fsys).pipe(Effect.orDie)
  yield* scan(state, defaultDir, SKILL_PATTERN)
  ```

已发生两次丢失（v1.14.48→v1.14.49、v1.15.0→v1.15.1）。参考提交：`456483d2c`（首次添加）、`9c818d201`（v1.14.49 后恢复）、`d6ce9a947`（v1.15.1 再次丢失）

## 5. Plan 工具门控条件

文件：`packages/opencode/src/tool/registry.ts`（builtin 列表）

- [ ] Plan 工具条件为 `flags.client === "cli"` only（不含 `experimentalPlanMode`）
  - 正确：`...(flags.client === "cli" ? [tool.plan, tool.planwrite, tool.planenter] : [])`
  - 错误：`...(flags.experimentalPlanMode && flags.client === "cli" ? ...)`

参考提交：`e612cc6f7` (sync: v1.15.4 -> v1.15.5)

## 6. postinstall.mjs — 品牌标识 + vendor 拷贝

文件：`packages/opencode/script/postinstall.mjs`

- [ ] **包名 base**：`` `@deveco/deveco-code-${platform}-${arch}` ``（非 `` `opencode-${platform}-${arch}` ``）
- [ ] **二进制名称**：`deveco`/`deveco.exe`（非 `opencode`/`opencode.exe`）
- [ ] **`resolvePackageDir(name)` 函数**存在，从 `require.resolve` 提取包目录
- [ ] **`copyDir(src, dst)` 函数**存在，递归拷贝目录
- [ ] **`copyVendor(packageDir)` 函数**存在，拷贝 `vendor/` 目录到 `__dirname`
- [ ] **直接解析路径**中调用 `copyVendor(resolvePackageDir(name))`
- [ ] **npm 临时安装路径**（`installPackage` 函数内）中调用 `copyVendor(packageDir)`

参考提交：`a3a7231cc`（恢复被上游覆盖丢失的品牌标识和 copyVendor 功能）

## 7. Claude 配置默认禁用

文件：`packages/opencode/src/effect/runtime-flags.ts`

- [ ] **`boolTrue` helper** 存在：`Config.boolean(name).pipe(Config.withDefault(true))`（与 `bool` 的 `withDefault(false)` 相反）
- [ ] **`disableClaudeCodePrompt`** 使用 `boolTrue`（非 `bool`）：`DEVECO_DISABLE_CLAUDE_CODE` 和 `DEVECO_DISABLE_CLAUDE_CODE_PROMPT` 均为默认 `true`
- [ ] **`disableClaudeCodeSkills`** 使用 `boolTrue`（非 `bool`）：`DEVECO_DISABLE_CLAUDE_CODE` 和 `DEVECO_DISABLE_CLAUDE_CODE_SKILLS` 均为默认 `true`，即默认不扫描 `.claude/skills/` 目录

文件：`packages/opencode/src/skill/index.ts`

- [ ] **无 `customize-opencode` 内置 skill**：上游注册了一个 `customize-opencode` 内置 skill（用于指导模型编辑 opencode 配置），DevEco Code 不需要此 skill，确认不存在相关 import、常量和注册逻辑
- [ ] **`CLAUDE_EXTERNAL_DIR` 被条件排除**：`discoverSkills` 中 `.claude` 目录仅在 `!disableClaudeCodeSkills` 时加入 `externalDirs`，默认被排除

参考提交：`e7bfb3401`（默认禁用 Claude 配置读取）、`259511193`（移除 customize-opencode 内置 skill）

## 8. TUI tips 品牌

文件：`packages/opencode/src/cli/cmd/tui/feature-plugins/home/tips-view.tsx`

- [ ] `TIPS` 数组中用户可见的 `opencode <command>` → `deveco <command>`
- [ ] `OpenCode` → `DevEco Code`
- [ ] 不改：`opencode.ai` URLs, `/opencode` `/oc` GitHub bot commands, `ghcr.io/anomalyco/opencode` Docker image, import paths, command IDs (e.g. `opencode.status`)

## 9. 数据库文件名与托管配置路径

文件：`packages/opencode/src/storage/db.ts`

- [ ] **数据库文件名**：`"deveco.db"` 和 `` `deveco-${channel}.db` ``（非 `opencode.db`）

文件：`packages/opencode/src/config/managed.ts`

- [ ] **MDM plist 域名**：`"ai.deveco.managed"`（非 `ai.opencode.managed`）
- [ ] **macOS 路径**：`"/Library/Application Support/deveco"`（非 `opencode`）
- [ ] **Windows 路径**：`path.join(..., "deveco")`（非 `opencode`）
- [ ] **Linux 路径**：`"/etc/deveco"`（非 `/etc/opencode`）

文件：`packages/opencode/src/config/agent.ts` 和 `command.ts`

- [ ] **搜索模式**：pattern 数组中不含 `/.opencode/` 条目，只有 `/.deveco/`
