# Upstream Sync Lessons

> 每次同步遇到的新坑。定期审查后抽象到 SKILL.md，已落地的条目删除。

<!-- 模板：
### v1.14.xx -> v1.14.yy — <一句话标题>

<现象和解决，2-3 行>
-->

### Plan agent 权限设定 — agent.ts 每次同步需检查

`packages/opencode/src/agent/agent.ts` 中 Plan agent 的权限是 DevEco Code 自定义配置，上游没有对应逻辑。每次同步如果上游修改了该文件，权限会被覆盖或冲突后丢失。**同步后必须验证以下权限配置未被还原：**

- **build agent**: `plan_enter: "ask"`, `plan_write: "deny"`
- **plan agent**: `plan_exit: "ask"`, `plan_write: "allow"`, `bash: "deny"`, `build_project: "deny"`, `check_ets_files: "deny"`, `perform_ui_action: "deny"`, `get_app_ui_tree: "deny"`, `start_app: "deny"`, `hdc_log: "deny"`, `switch_cwd: "deny"`, `arkts_knowledge_search: "deny"`, `edit: "deny"`

参考提交：`6067f5a6` ("Agent权限设定")

### HarmonyOS 自定义工具注册丢失 — registry.ts 每次同步需检查

`packages/opencode/src/tool/registry.ts` 中注册了三个 HarmonyOS 自定义工具（`HdcLogTool`、`SwitchCwdTool`、`OhKnowledgeTool`）和两个 Plan 工具（`PlanWriteTool`、`PlanEnterTool`），上游不存在这些工具。当上游重构 registry 架构（如 v1.15.0 的工具重命名 BashTool→ShellTool、v1.15.5 的 EffectBridge/Layer 重构）时，自定义工具的 import、初始化、注册和 Layer 依赖会被静默丢弃——即使没有冲突标记。**每次同步后必须验证**：

1. `HdcLogTool`、`SwitchCwdTool`、`OhKnowledgeTool`、`PlanWriteTool`、`PlanEnterTool` 的 import 语句存在
2. `Auth.Service` 在 Layer 依赖类型中（OhKnowledgeTool 需要）
3. `yield*` 初始化存在
4. `Tool.init()` 注册存在
5. builtin 列表中有 `tool.hdclog`、`tool.switchcwd`、`tool.ohknowledge`；`tool.planwrite`、`tool.planenter` 与 `tool.plan` 同在 `flags.client === "cli"` 条件下（**不含** `experimentalPlanMode`，Plan 模式是已发布功能非实验性）
6. `defaultLayer` 中有 `Layer.provide(Auth.defaultLayer)`

已抽象到 SKILL.md Known Pitfalls 的 Critical 级别。

### packages/opencode/package.json 自定义依赖丢失 — 每次同步需检查

`@deveco-codegenie/mcp-bridge*` 是 DevEco Code 自定义依赖，上游不存在这些包。同步时 `packages/opencode/package.json` 冲突解决如果直接接受上游版本，会同时丢失：

1. **mcp-bridge 依赖**（在 `devDependencies` 和 `dependencies` 中各有 4 个包）：
   - `@deveco-codegenie/mcp-bridge`
   - `@deveco-codegenie/mcp-bridge-darwin-arm64`
   - `@deveco-codegenie/mcp-bridge-darwin-x64`
   - `@deveco-codegenie/mcp-bridge-win32-x64`
2. **bin 字段**：会被还原为 `"opencode": "./bin/opencode"`，应为 `"deveco": "./bin/deveco"`

此问题已反复发生（v1.14.44→v1.14.45、v1.14.50→v1.14.51 各丢失一次），**每次同步后必须验证上述内容完整**。

参考提交：`456483d2c`（首次添加）、`2d4aac556`（v1.14.50→v1.14.51 再次丢失）

### v1.15.0 -> v1.15.1 — Instance context refactoring and flag migration

上游进行了大规模 Effect instance context 重构，影响深远：
1. **删除 `project/instance.ts`**：`Instance` 类被移除，`Instance.containsPath()` 迁移到 `instance-context.ts` 的 `containsPath()`，`Instance.directory` 迁移到 `InstanceState`。自动合并不会更新非冲突文件的 import，导致 `external-directory.ts`、`file/index.ts`、`switch-cwd.ts`（我们的自定义文件）仍引用已删除的模块。**必须全局搜索 `from "../project/instance"` 和 `from "@/project/instance"` 来捕获所有断裂引用。**
2. **Flag 迁移到 runtime-flags**：`Flag.OPENCODE_DISABLE_LSP_DOWNLOAD`、`OPENCODE_SKIP_MIGRATIONS`、`OPENCODE_DISABLE_EXTERNAL_SKILLS`、`OPENCODE_DISABLE_CLAUDE_CODE` 等从静态 `Flag` 单例迁移到 `RuntimeFlags` Effect service。调用方从 `Flag.X` 改为 `flags.x`（通过 `yield* RuntimeFlags.Service` 获取）。这导致 `lsp/server.ts` 有 22 个相同模式的冲突。
3. **`effect/bridge.ts` 重构**：新增独立的 `bind()` 和 `fromPromise()` 导出，旧的 `make()` 返回的 `bind` 属性仍保留。`captureSync()` 从 `Instance.current`（旧的线程局部变量模式）改为 `Fiber.getCurrent()` + `Context.getReferenceUnsafe`（新的 Effect context 引用模式）。
4. **`run-service.ts` 的 `attach()`**：同样从 `Instance.current` / `LocalContext.NotFound` try-catch 模式改为 `Fiber.getCurrent()` 模式。
5. **`project/with-instance.ts` 也被删除**：上游移除了 WithInstance adapter 模式。

### v1.15.4 -> v1.15.5 — 风险登记（供 upstream-sync-reviewer 重点关注）

> 以下条目供 Step 9 的 review agent 重点审查。同步完成后逐项确认。

#### HIGH: `packages/opencode/src/session/llm.ts` — 原生 LLM runtime 大重构

上游新增 `@opencode-ai/llm` 包，引入 `LLMClient`、`RequestExecutor`、`LLMClientService` 等新类型，请求头架构完全重写（opencode provider 加 `x-opencode-project/session/request/client` 头，其他 provider 加 `x-session-affinity` 头）。本地有 `DEVECO_*` 品牌标识和调试日志。**审查要点**：
- 合并后所有新增的 `OPENCODE_` 标识是否已替换为 `DEVECO_`（包括 define、env var、header 中的用户可见字符串）
- 调试日志（`l.info("model request starting")`）是否完整保留或已由上游替代方案覆盖
- `crypto` import 是否仍被使用（本地添加的）

#### MEDIUM: `packages/opencode/package.json` — 新增 workspace 依赖 + 自定义依赖保留

上游新增 `@opencode-ai/llm` 和 `@opencode-ai/http-recorder` 两个 workspace 依赖，新增 `bench:test` 和 `profile:test` 两个 script。**审查要点**：
- `name` 仍为 `"deveco"`、`bin` 仍为 `"deveco": "./bin/deveco"`
- `@deveco-codegenie/mcp-bridge*`（4 包 × 2 处 = 8 条目）完整存在
- 新增的上游依赖已正确引入

#### MEDIUM: Build scripts — `OPENCODE_MODELS_DEV` 新 define + models-snapshot 删除

`generate.ts` 不再写入 `models-snapshot.js`/`.d.ts`，改为 `export const modelsData`。`build.ts` 和 `build-node.ts` 新增 `OPENCODE_MODELS_DEV` define。**审查要点**：
- 所有 `OPENCODE_*` define 已替换为 `DEVECO_*`（`DEVECO_MODELS_DEV`、`DEVECO_VERSION`、`DEVECO_MIGRATIONS` 等）
- `DEVECO_DEFAULT_SKILLS` 和 `DEVECO_DEFAULT_SPEC_RESOURCES`（本地自定义 define）未被丢失
- `generate.ts` 中 `DEVECO_MODELS_URL` 品牌标识正确

#### MEDIUM: `runtime-flags.ts` — 新增 `experimentalNativeLlm` flag

上游新增 `experimentalNativeLlm: enabledByExperimental("OPENCODE_EXPERIMENTAL_NATIVE_LLM")`。**审查要点**：
- 新 flag 使用 `DEVECO_EXPERIMENTAL_NATIVE_LLM`
- 原有 flags 品牌标识未被回退

#### LOW: Test files — 品牌标识

`provider.test.ts`、`llm.test.ts`、`skill.test.ts` 中 `OPENCODE_TEST_HOME` → `DEVECO_TEST_HOME`，`opencode.json` → `deveco.json`。

### v1.14.51 -> v1.15.0 — TUI tips branding replacement

`packages/opencode/src/cli/cmd/tui/feature-plugins/home/tips-view.tsx` 中的 `TIPS` 数组包含用户可见的 `opencode` CLI 命令引用和 `OpenCode` 字符串。每次同步后需替换：`opencode <command>` → `deveco <command>`，`OpenCode` → `DevEco Code`。保留不变：`opencode.ai` URL、`/opencode` `/oc` GitHub bot 命令、`ghcr.io/anomalyco/opencode` Docker 镜像、import 路径、命令 ID（如 `opencode.status`）。

### Plan 工具门控条件被上游覆盖 — registry.ts 每次同步需检查

上游 v1.15.0 在 `packages/opencode/src/tool/registry.ts` 的 builtin 列表中为 Plan 工具（PlanExitTool）加了 `experimentalPlanMode` 门控：`flags.experimentalPlanMode && flags.client === "cli"`。DevEco Code 的 Plan 模式是已发布的核心功能，不依赖任何环境变量。**每次同步后必须验证 Plan 工具的 builtin 条件不包含 `experimentalPlanMode`**：

- 正确：`...(flags.client === "cli" ? [tool.plan, tool.planwrite, tool.planenter] : [])`
- 错误：`...(flags.experimentalPlanMode && flags.client === "cli" ? ...)`

参考提交：`e612cc6f7` (sync: v1.15.4 -> v1.15.5，修复于此提交之后)

### Defaults.ensure 调用被上游覆盖 — skill/index.ts 每次同步需检查

`packages/opencode/src/skill/defaults.ts` 和 `Defaults.ensure` 是 DevEco Code 独有的功能（上游不存在 `defaults.ts`），负责将编译时嵌入的 `resources/skills/` 内置 HarmonyOS skills 解压到磁盘供 skill 发现机制扫描。当上游重构 `discoverSkills` 函数签名（如 v1.15.0→v1.15.1 的 Flag→RuntimeFlags 迁移）时，合并冲突解决采用上游函数体会直接丢弃 `Defaults.ensure` 调用——即使 `defaults.ts` 文件本身不冲突。已发生两次（v1.14.48→v1.14.49、v1.15.0→v1.15.1）。**每次同步后必须验证**：

1. `defaults.ts` 文件存在且 `DEVECO_DEFAULT_SKILLS` declare 正确
2. `index.ts` 中 `import { Defaults } from "./defaults"` 和 `import { InstallationVersion } from "@opencode-ai/core/installation/version"` 存在
3. `discoverSkills` 函数体开头有：
   ```ts
   const defaultDir = yield* Defaults.ensure(InstallationVersion, fsys).pipe(Effect.orDie)
   yield* scan(state, defaultDir, SKILL_PATTERN)
   ```

参考提交：`456483d2c`（首次添加）、`9c818d201`（v1.14.49 后恢复）、`d6ce9a947`（v1.15.1 再次丢失）
