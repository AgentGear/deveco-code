# Upstream Sync Lessons

> 每次同步遇到的新坑。定期审查后抽象到 `references/pitfalls.md`，已落地的条目删除。

<!-- 模板：
### v1.14.xx -> v1.14.yy — <一句话标题>

<现象和解决，2-3 行>
-->

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

### v1.15.0 -> v1.15.1 — Instance context refactoring and flag migration

上游进行了大规模 Effect instance context 重构，影响深远：
1. **删除 `project/instance.ts`**：`Instance` 类被移除，`Instance.containsPath()` 迁移到 `instance-context.ts` 的 `containsPath()`，`Instance.directory` 迁移到 `InstanceState`。自动合并不会更新非冲突文件的 import，导致 `external-directory.ts`、`file/index.ts`、`switch-cwd.ts`（我们的自定义文件）仍引用已删除的模块。**必须全局搜索 `from "../project/instance"` 和 `from "@/project/instance"` 来捕获所有断裂引用。**
2. **Flag 迁移到 runtime-flags**：`Flag.OPENCODE_DISABLE_LSP_DOWNLOAD`、`OPENCODE_SKIP_MIGRATIONS`、`OPENCODE_DISABLE_EXTERNAL_SKILLS`、`OPENCODE_DISABLE_CLAUDE_CODE` 等从静态 `Flag` 单例迁移到 `RuntimeFlags` Effect service。调用方从 `Flag.X` 改为 `flags.x`（通过 `yield* RuntimeFlags.Service` 获取）。这导致 `lsp/server.ts` 有 22 个相同模式的冲突。
3. **`effect/bridge.ts` 重构**：新增独立的 `bind()` 和 `fromPromise()` 导出，旧的 `make()` 返回的 `bind` 属性仍保留。`captureSync()` 从 `Instance.current`（旧的线程局部变量模式）改为 `Fiber.getCurrent()` + `Context.getReferenceUnsafe`（新的 Effect context 引用模式）。
4. **`run-service.ts` 的 `attach()`**：同样从 `Instance.current` / `LocalContext.NotFound` try-catch 模式改为 `Fiber.getCurrent()` 模式。
5. **`project/with-instance.ts` 也被删除**：上游移除了 WithInstance adapter 模式。
