---
name: upstream-sync
description: Sync upstream OpenCode releases into the DevEco Code fork. Use when the user asks to sync, merge, or update from the OpenCode upstream (e.g. "sync upstream", "merge OpenCode v1.14.xx", "update from upstream"). Covers git graft repair, merge analysis, conflict resolution with brand preservation (DEVECO_*), squash commit workflow, and post-sync verification.
---

# Upstream Sync

Sync upstream OpenCode release tags into the DevEco Code fork on the `develop` branch.

## Remote

| Name | URL | Purpose |
|------|-----|---------|
| `upstream` | `git@github.com:anomalyco/opencode.git` (SSH) / `https://github.com/anomalyco/opencode.git` (HTTPS) | OpenCode upstream source |

## Brand Identifier Mapping

When resolving conflicts and verifying merges, replace upstream identifiers with local equivalents:

| Upstream | Local | Scope | Exceptions |
|----------|-------|-------|------------|
| `OPENCODE_` (env vars/flags) | `DEVECO_` | All `.ts`/`.tsx` files in `packages/` | Do NOT replace in `infra/enterprise.ts` (SST deployment config keys) or `sdks/vscode/` (external API identifiers like `_EXTENSION_OPENCODE_PORT`, `OPENCODE_CALLER`) |
| `opencode` (package names) | `deveco` | `package.json` name field | — |
| `OpenCode` (user-facing strings) | `DevEco Code` | UI strings, titles, descriptions | — |
| `opencode` (user-visible process strings) | `deveco` | Titles, prompts, terminal display names only. Do NOT rename bin field, providerID, import paths, or test identifiers | — |

## Sync Strategy

- Always sync from upstream **release tags** (e.g. `v1.14.33`), never from branches
- Preserve upstream commit history: use `git merge --no-ff`
- Convert to single-parent squash commit after resolving conflicts

## Workflow

### Step 1: Prepare

```bash
# Prerequisites — fail early if not met
git remote -v | grep upstream       # upstream remote must exist
git branch --show-current           # must be on develop
git status                          # clean working tree

# Read current baseline version — this is the single source of truth
# <old-tag> = contents of .agents/upstream-sync/BASELINE.md (e.g. v1.14.49)
git fetch upstream --tags           # fetch latest tags
git log --oneline <old-tag>..<new-tag>  # review scope
```

Verify target tag exists — upstream may skip versions (e.g. no v1.14.36).

### Step 2: Repair Graft

Historical sync commits are single-parent (squash), so git doesn't recognize upstream tags as ancestors. Without graft, the merge range explodes to thousands of commits because git thinks it needs to merge the entire history.

```bash
# Check if graft already exists
git merge-base --is-ancestor <old-tag> develop && echo "OK: graft exists"
# If OK, skip to Step 3

# Otherwise, find last sync commit and build graft
git log --oneline develop | grep "sync:"
# <sync-commit> = the commit found above
# <actual-parent> = its current parent: git show <sync-commit> --format="%P" --no-patch
# <old-tag-hash> = git rev-parse <old-tag>
git replace --graft <sync-commit> <actual-parent> <old-tag-hash>

# Verify — must use PREVIOUS synced tag, not the target tag
# Using the target tag makes git report "Already up to date"
git merge-base --is-ancestor <old-tag> develop && echo "OK"
```

### Step 3: Pre-merge Analysis (present report, wait for user confirmation)

1. `git diff <old-tag>..<new-tag> --stat` — changed files
2. `git merge --no-commit --no-ff <new-tag>` — simulated merge
3. `git diff --name-only --diff-filter=U` — conflicted files
4. For each conflicted file: classify (version bump / brand / feature logic / new config) and check if it involves DevEco Code custom features
5. Check `git diff --stat` for rename lines — upstream renames (e.g. module migration to `packages/core`) won't produce conflict markers but all import paths need updating
6. Check `.agents/upstream-sync/LESSONS.md` for version-specific historical pitfalls
7. `git merge --abort`
8. Output: change summary / conflict list with recommendations / high-risk items / overall assessment

**Skip-version assessment**: if all changes are in modules we don't use (e.g. upstream-only CI configs, unrelated platform fixes), recommend skipping to the user.

**Wait for user confirmation before continuing.**

### Step 4: Execute Merge

```bash
git merge --no-ff <new-tag> --no-edit
```

Resolve conflicts by category (batch where possible):

| Category | Resolution | Notes |
|----------|-----------|-------|
| package.json version bumps | `git checkout --theirs -- <file>` (batch) | All `**/package.json` version fields |
| bun.lock | `git checkout --theirs bun.lock` | |
| packages/opencode/package.json | Accept version, keep `name: "deveco"`, `bin: "deveco"`, and all `@deveco-codegenie/*` custom dependencies | Custom deps and bin field are overwritten on every sync; see Known Pitfalls |
| packages/web/package.json | Accept version, ensure `"deveco": "workspace:*"` in `devDependencies` | Reverts to `opencode` on every sync |
| packages/extensions/zed/extension.toml | Accept upstream version + download URL | |
| Feature logic files | Analyze individually: accept upstream architecture, keep `DEVECO_*` branding | |
| Test files (`*.test.ts`) | Accept upstream, replace `OPENCODE_` env vars → `DEVECO_` only | Do NOT rename providerID, external API headers, or functional identifiers — same rule applies to all files |
| Documentation (`*.md`) | Accept upstream | Upstream `AGENTS.md` → overwrite local `OPENCODE-AGENTS.md` |
| Config (tsconfig, turbo.json) | Local as base, merge upstream additions | |

When merging import blocks: **deduplicate** — simple concatenation produces duplicate identifiers (`TS2300`).

**Rollback** (if merge goes wrong):
```bash
git merge --abort           # before committing
git reset --hard HEAD~1     # after committing but before push (use with caution)
```

### Step 5: Squash Commit

The two-step commit + reset creates a single-parent commit that preserves the merge result but keeps history clean.

```bash
SKIP_SPECS_CHECK=1 git commit --no-edit
git reset --soft HEAD~1
# Ensure all fixes are staged before this commit:
git status  # verify clean or all changes staged
SKIP_SPECS_CHECK=1 git commit -m "sync: OpenCode <old-tag> -> <new-tag>

Upstream commits:
- <commit 1>
- ...

Conflicts resolved: <N> files
- <file/module>: <resolution>

Brand identifiers preserved throughout, HarmonyOS tools and plugins retained
Baseline updated in BASELINE.md

Signed-off-by: GIT_USER <GIT_EMAIL>"  # use `git config user.name` and `git config user.email`
```

All sync-related git commits must use `SKIP_SPECS_CHECK=1` prefix.

### Step 6: Clean Graft (only if Step 2 created one)

```bash
git replace -d <sync-commit>
```

### Step 7: Verify

1. `bun install` — no errors
2. `bun run typecheck` — **critical**: auto-merged files may have hidden type errors from upstream API changes (signatures, imports, renames, module migrations)
3. `bun turbo build --filter=deveco` — build passes
4. `grep -r "OPENCODE_" packages/ infra/ sdks/ --include="*.ts" --include="*.tsx"` — verify no stale upstream env var prefixes in `packages/` (check both existing AND new files). Hits in `infra/` and `sdks/vscode/` are expected — these are functional identifiers that must NOT be renamed
5. Verify brand identifier mapping completeness (see Brand Identifier Mapping table above)
6. Fix issues and amend: `SKIP_SPECS_CHECK=1 git commit --amend --no-edit`

### Step 8: Update Baseline and Lessons

> **MANDATORY — DO NOT SKIP**: Update `.agents/upstream-sync/BASELINE.md` with the new tag (e.g. `v1.14.50`). This file is the single source of truth for the current upstream baseline. Skipping this will cause the next sync's graft repair to fail.

If new issues or traps encountered, add to `.agents/upstream-sync/LESSONS.md`.

### Step 9: Post-Sync Assessment

Launch the `upstream-sync` subagent to perform a comprehensive post-sync quality assessment. The subagent audits the sync results against all known pitfalls and brand mapping rules, then generates a structured assessment report.

1. Launch the subagent via the `Agent` tool with `subagent_type="general-purpose"`. The subagent prompt is located at `.agents/skills/upstream-sync/assessment-agent-prompt.md`.
2. The subagent will produce a report covering: brand identifier audit, custom dependency verification, workspace dependency check, agent permission audit, import path integrity, TUI branding check, and known pitfalls cross-check.
3. **After receiving the report**, the main Agent must:
   - Review all issues in the report
   - Apply fixes for each issue, prioritizing Critical → Branding → Config → Recommendations
   - Re-run verification (Step 7) to confirm all fixes are effective
   - Amend the sync commit if fixes were applied: `SKIP_SPECS_CHECK=1 git commit --amend --no-edit`

## Conflict Resolution Priority (highest to lowest)

1. **DevEco Code custom features** (branding `DEVECO_*`/`DevEco Code`, HarmonyOS, custom flags) — always keep local
2. **Upstream feature changes** (bug fixes, enhancements, dependency upgrades, refactors) — accept upstream
3. **Config and build scripts** — local as base, merge upstream additions; if conflicts with #1, follow #1

## Known Pitfalls

> Ordered by severity. Cross-referenced with workflow steps.

### Critical — will cause silent breakage

- **packages/opencode/package.json custom dependencies lost** *(Step 4)*: upstream does not have `@deveco-codegenie/*` packages, so accepting upstream's package.json drops them from both `dependencies` and `devDependencies`. Additionally, the `bin` field reverts from `"deveco"` to `"opencode"`. After resolving package.json conflicts, always verify these are present:
  - `"bin": { "deveco": "./bin/deveco" }` (not `"opencode"`)
  - In both `devDependencies` and `dependencies`: `@deveco-codegenie/mcp-bridge`, `@deveco-codegenie/mcp-bridge-darwin-arm64`, `@deveco-codegenie/mcp-bridge-darwin-x64`, `@deveco-codegenie/mcp-bridge-win32-x64`
- **Auto-merge overwrites brand identifiers** *(Step 4, Step 7)*: git auto-merges `OPENCODE_` env var prefixes without conflict, silently overwriting `DEVECO_` renames. New files from upstream also carry `OPENCODE_`. Always grep all packages (not just conflicted files) — see Step 7 verification.
- **Typecheck is mandatory** *(Step 7)*: upstream API changes (signatures, imports, renames, module migrations to `packages/core`) produce type errors in auto-merged files. `bun run typecheck` catches what merge conflict markers don't.
- **Upstream renames hide import breakage** *(Step 3, Step 4)*: when upstream moves modules (e.g. `util/schema.ts` → `packages/core/src/`), git shows rename but auto-merged referencing files keep old import paths. Check `git diff --stat` rename lines.
- **workspace dep name resets** *(Step 4)*: `packages/web/package.json` reverts to `"opencode": "workspace:*"` on every sync. Always verify.
- **Agent tool permission overwrites** *(Step 3, Step 4)*: `packages/opencode/src/agent/agent.ts` — DevEco Code customizes permissions for two agents. When upstream restructures the permission format, naive conflict resolution drops these rules. **Accept upstream's new permission structure, but always re-add all custom permissions:**
  - **build agent**: `plan_enter: "ask"`, `plan_write: "deny"` (upstream defaults: `"allow"` / absent)
  - **plan agent**: `plan_exit: "ask"`, `plan_write: "allow"`, `edit: "deny"`, plus 9 HarmonyOS tool deny rules (`bash`, `build_project`, `check_ets_files`, `perform_ui_action`, `get_app_ui_tree`, `start_app`, `hdc_log`, `switch_cwd`, `arkts_knowledge_search`)

### Moderate — causes errors or incorrect behavior

- **Import deduplication** *(Step 4)*: merging import blocks by concatenation creates duplicate identifiers (`TS2300`). Always dedupe.
- **Graft tag must be previous, not target** *(Step 2)*: using the target tag makes git report "Already up to date".
- **macOS sed unreliable**: use `perl -pi -e 's/OLD/NEW/g' file` for batch replacements.
- **Parenthesis matching** *(Step 4)*: replacing function calls (e.g. `Effect.promise` → `EffectBridge.fromPromise`) may retain old closing parens. Check surrounding code.

### Advisory — improves quality

- **Upstream may have better implementation** *(Step 4)*: when local custom code conflicts with upstream's new version of the same feature, check if upstream covers the use case before mechanically keeping local.
- **Rebase to cloud branch**: after rebasing sync commits onto cloud-side develop, compare all cloud-side merge commit changes against current code — `--theirs` may overwrite custom dependencies (mcp-bridge etc).
- **Not all `opencode` strings should be renamed** *(Step 4)*: `opencode` appears as provider IDs, external API headers (`X-Title`, `X-Source`), test fixtures, and npm bin names — these are functional identifiers, not brand strings. Only rename user-facing strings and env var prefixes. See Brand Identifier Mapping table for exact scope.
- **Not all `OPENCODE_` env vars should be replaced** *(Step 4, Step 7)*: `OPENCODE_` prefixes in `infra/enterprise.ts` (SST deployment config keys like `OPENCODE_STORAGE_ADAPTER`) and `sdks/vscode/src/extension.ts` (external API identifiers like `_EXTENSION_OPENCODE_PORT`, `OPENCODE_CALLER`) are functional identifiers shared with external systems — do NOT rename them.
- **TUI tips branding** *(Step 4, Step 7)*: `packages/opencode/src/cli/cmd/tui/feature-plugins/home/tips-view.tsx` — the `TIPS` array contains user-facing `opencode` CLI command references and `OpenCode` strings. After each sync, replace user-visible `opencode <command>` → `deveco <command>` and `OpenCode` → `DevEco Code`. Do NOT rename: `opencode.ai` URLs, `/opencode` `/oc` GitHub bot commands, `ghcr.io/anomalyco/opencode` Docker image, import paths, or command IDs (e.g. `opencode.status`).
