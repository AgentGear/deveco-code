# Known Pitfalls

> Ordered by severity. Cross-referenced with workflow steps.
>
> **注意**：下方的代码片段仅为历史参考实现。上游可能大规模重构，Agent 应根据同步后实际的代码架构来判断功能是否正确保留，而非机械匹配代码片段。

## Critical — will cause silent breakage

- **packages/opencode/package.json custom dependencies lost** *(Step 4)*: upstream does not have `@deveco-codegenie/*` packages, so accepting upstream's package.json drops them from both `dependencies` and `devDependencies`. Additionally, the `bin` field reverts from `"deveco"` to `"opencode"`. After resolving package.json conflicts, always verify these are present:
  - `"bin": { "deveco": "./bin/deveco" }` (not `"opencode"`)
  - In both `devDependencies` and `dependencies` (inserted in dictionary order): `@deveco-codegenie/mcp-bridge`, `@deveco-codegenie/mcp-bridge-darwin-arm64`, `@deveco-codegenie/mcp-bridge-darwin-x64`, `@deveco-codegenie/mcp-bridge-win32-x64`
- **Auto-merge overwrites brand identifiers** *(Step 4, Step 7)*: git auto-merges `OPENCODE_` env var prefixes without conflict, silently overwriting `DEVECO_` renames. New files from upstream also carry `OPENCODE_`. Always grep all packages (not just conflicted files) — see Step 7 verification.
- **Typecheck is mandatory** *(Step 7)*: upstream API changes (signatures, imports, renames, module migrations to `packages/core`) produce type errors in auto-merged files. `bun run typecheck` catches what merge conflict markers don't.
- **Upstream renames hide import breakage** *(Step 3, Step 4)*: when upstream moves modules (e.g. `util/schema.ts` → `packages/core/src/`), git shows rename but auto-merged referencing files keep old import paths. Check `git diff --stat` rename lines.
- **workspace dep name resets** *(Step 4)*: `packages/web/package.json` reverts to `"opencode": "workspace:*"` on every sync. Always verify.
- **Agent tool permission overwrites** *(Step 3, Step 4)*: `packages/opencode/src/agent/agent.ts` — DevEco Code customizes permissions for two agents. When upstream restructures the permission format, naive conflict resolution drops these rules. **Accept upstream's new permission structure, but always re-add all custom permissions:**
  - **build agent**: `plan_enter: "ask"`, `plan_write: "deny"` (upstream defaults: `"allow"` / absent)
  - **plan agent**: `plan_exit: "ask"`, `plan_write: "allow"`, `edit: "deny"`, plus 9 HarmonyOS tool deny rules (`bash`, `build_project`, `check_ets_files`, `perform_ui_action`, `get_app_ui_tree`, `start_app`, `hdc_log`, `switch_cwd`, `arkts_knowledge_search`)
- **HarmonyOS custom tool registrations dropped** *(Step 3, Step 4, Step 7)*: `packages/opencode/src/tool/registry.ts` — upstream does not have HarmonyOS tools, so when upstream restructures the registry (renames tools, changes the import/init/builtin pattern, adds new Layer dependencies), the custom tool registrations are silently dropped even without conflict markers. **After every sync, verify the following functional requirements are met (adapt to current architecture):**
  - **Imports**: `HdcLogTool` from `"./hdc_log"`, `SwitchCwdTool` from `"./switch-cwd"`, `OhKnowledgeTool` from `"./oh_knowledge"`, `Auth` from `"@/auth"`, `PlanWriteTool` and `PlanEnterTool` from `"./plan"` (alongside existing `PlanExitTool`)
  - **Layer dependency**: `Auth.Service` in the `Layer.Layer` type union
  - **Initialization**: `yield* HdcLogTool`, `yield* SwitchCwdTool`, `yield* OhKnowledgeTool`, `yield* PlanWriteTool`, `yield* PlanEnterTool`, `yield* Auth.Service`
  - **Tool.init()**: `hdclog`, `switchcwd`, `ohknowledge`, `planwrite`, `planenter` in the `Effect.all` block
  - **ohknowledge OAuth 门控**: ohknowledge 工具仅在用户通过 deveco OAuth 认证时注册到 Builtin 列表。参考实现：
    ```ts
    const authInfo = yield* auth.get("deveco").pipe(Effect.orElseSucceed(() => undefined))
    const ohknowledgeEnabled = authInfo !== undefined && authInfo.type === "oauth"
    ```
    Builtin 列表中使用 `...(ohknowledgeEnabled ? [tool.ohknowledge] : [])` 条件展开（参考提交 `fee1ab5e`）
  - **Builtin list**: `tool.hdclog`, `tool.switchcwd`, and `...(ohknowledgeEnabled ? [tool.ohknowledge] : [])` (with `// HarmonyOS tools` comment); `tool.planwrite`, `tool.planenter` alongside `tool.plan` gated by `flags.client === "cli"` only (**NOT** `experimentalPlanMode` — Plan mode is a core DevEco Code feature, not experimental)
  - **defaultLayer**: `Layer.provide(Auth.defaultLayer)` in the provider chain
- **Plan tools gating condition overwritten** *(Step 3, Step 4, Step 7)*: upstream v1.15.0 added `experimentalPlanMode` to the Plan tools builtin condition. DevEco Code does not require this flag — Plan mode is a shipped feature. **After every sync, verify plan tools are gated only by client type, without experimentalPlanMode.**
  - Correct: `...(flags.client === "cli" ? [tool.plan, tool.planwrite, tool.planenter] : [])`
  - Wrong: `...(flags.experimentalPlanMode && flags.client === "cli" ? [tool.plan, tool.planwrite, tool.planenter] : [])`
- **Default skills extraction call dropped** *(Step 3, Step 4, Step 7)*: `packages/opencode/src/skill/index.ts` — upstream does not have `defaults.ts` (DevEco Code only), so when upstream refactors the `discoverSkills` function signature or body (e.g. Flag→RuntimeFlags migration), merging adopts upstream's function body and silently drops the `Defaults.ensure()` call. This has happened twice (v1.14.48→v1.14.49, v1.15.0→v1.15.1). **After every sync, verify:**
  - `defaults.ts` file exists with `DEVECO_DEFAULT_SKILLS` declare
  - `index.ts` imports: `import { Defaults } from "./defaults"` and `import { InstallationVersion } from "@opencode-ai/core/installation/version"`
  - `discoverSkills` function body starts with:
    ```ts
    const defaultDir = yield* Defaults.ensure(InstallationVersion, fsys).pipe(Effect.orDie)
    yield* scan(state, defaultDir, SKILL_PATTERN)
    ```

## Moderate — causes errors or incorrect behavior

- **Import deduplication** *(Step 4)*: merging import blocks by concatenation creates duplicate identifiers (`TS2300`). Always dedupe.
- **Graft tag must be previous, not target** *(Step 2)*: using the target tag makes git report "Already up to date".
- **macOS sed unreliable**: use `perl -pi -e 's/OLD/NEW/g' file` for batch replacements.
- **Parenthesis matching** *(Step 4)*: replacing function calls (e.g. `Effect.promise` → `EffectBridge.fromPromise`) may retain old closing parens. Check surrounding code.

## Advisory — improves quality

- **Upstream may have better implementation** *(Step 4)*: when local custom code conflicts with upstream's new version of the same feature, check if upstream covers the use case before mechanically keeping local.
- **Rebase to cloud branch**: after rebasing sync commits onto cloud-side develop, compare all cloud-side merge commit changes against current code — `--theirs` may overwrite custom dependencies (mcp-bridge etc).
- **Not all `opencode` strings should be renamed** *(Step 4)*: `opencode` appears as provider IDs, external API headers (`X-Title`, `X-Source`), test fixtures, and npm bin names — these are functional identifiers, not brand strings. Only rename user-facing strings and env var prefixes. See Brand Identifier Mapping table for exact scope.
- **Not all `OPENCODE_` env vars should be replaced** *(Step 4, Step 7)*: `OPENCODE_` prefixes in `infra/enterprise.ts` (SST deployment config keys like `OPENCODE_STORAGE_ADAPTER`) and `sdks/vscode/src/extension.ts` (external API identifiers like `_EXTENSION_OPENCODE_PORT`, `OPENCODE_CALLER`) are functional identifiers shared with external systems — do NOT rename them.
- **TUI tips branding** *(Step 4, Step 7)*: `packages/opencode/src/cli/cmd/tui/feature-plugins/home/tips-view.tsx` — the `TIPS` array contains user-facing `opencode` CLI command references and `OpenCode` strings. After each sync, replace user-visible `opencode <command>` → `deveco <command>` and `OpenCode` → `DevEco Code`. Do NOT rename: `opencode.ai` URLs, `/opencode` `/oc` GitHub bot commands, `ghcr.io/anomalyco/opencode` Docker image, import paths, or command IDs (e.g. `opencode.status`).
- **Auto-upgrade is npm-registry-only** *(Step 3, Step 4)*: DevEco Code only distributes via npm registry (`npm`/`pnpm`/`bun`). Upstream's `packages/opencode/src/installation/index.ts` also supports `brew`/`choco`/`scoop`/`curl`/`yarn`, but these are irrelevant to our distribution. Upstream changes to non-npm installation paths can be accepted as-is — they have no effect on DevEco Code auto-upgrade. The CLI `deveco upgrade --method` already limits choices to `["npm", "pnpm", "bun"]` (`packages/opencode/src/cli/cmd/upgrade.ts:20`).
