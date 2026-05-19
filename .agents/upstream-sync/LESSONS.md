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

### v1.14.51 -> v1.15.0 — TUI tips branding replacement

`packages/opencode/src/cli/cmd/tui/feature-plugins/home/tips-view.tsx` 中的 `TIPS` 数组包含用户可见的 `opencode` CLI 命令引用和 `OpenCode` 字符串。每次同步后需替换：`opencode <command>` → `deveco <command>`，`OpenCode` → `DevEco Code`。保留不变：`opencode.ai` URL、`/opencode` `/oc` GitHub bot 命令、`ghcr.io/anomalyco/opencode` Docker 镜像、import 路径、命令 ID（如 `opencode.status`）。
