# Brand Identifier Mapping

When resolving conflicts and verifying merges, replace upstream identifiers with local equivalents:

| Upstream | Local | Scope | Exceptions |
|----------|-------|-------|------------|
| `OPENCODE_` (env vars/flags) | `DEVECO_` | All `.ts`/`.tsx` files in `packages/` | Do NOT replace in `infra/enterprise.ts` (SST deployment config keys) or `sdks/vscode/` (external API identifiers like `_EXTENSION_OPENCODE_PORT`, `OPENCODE_CALLER`) |
| `opencode` (package names) | `deveco` | `package.json` name field | — |
| `OpenCode` (user-facing strings) | `DevEco Code` | UI strings, titles, descriptions | — |
| `opencode` (user-visible process strings) | `deveco` | Titles, prompts, terminal display names only. Do NOT rename bin field, providerID, import paths, or test identifiers | — |

## What NOT to Rename

Not all `opencode` strings should be renamed. `opencode` appears as provider IDs, external API headers (`X-Title`, `X-Source`), test fixtures, and npm bin names — these are functional identifiers, not brand strings. Only rename user-facing strings and env var prefixes. See table above for exact scope.

Not all `OPENCODE_` env vars should be replaced. `OPENCODE_` prefixes in `infra/enterprise.ts` (SST deployment config keys like `OPENCODE_STORAGE_ADAPTER`) and `sdks/vscode/src/extension.ts` (external API identifiers like `_EXTENSION_OPENCODE_PORT`, `OPENCODE_CALLER`) are functional identifiers shared with external systems — do NOT rename them.

## TUI Tips Branding

`packages/opencode/src/cli/cmd/tui/feature-plugins/home/tips-view.tsx` — the `TIPS` array contains user-facing `opencode` CLI command references and `OpenCode` strings. After each sync, replace user-visible `opencode <command>` → `deveco <command>` and `OpenCode` → `DevEco Code`. Do NOT rename: `opencode.ai` URLs, `/opencode` `/oc` GitHub bot commands, `ghcr.io/anomalyco/opencode` Docker image, import paths, or command IDs (e.g. `opencode.status`).

## Auto-upgrade Note

DevEco Code only distributes via npm registry (`npm`/`pnpm`/`bun`). Upstream's `packages/opencode/src/installation/index.ts` also supports `brew`/`choco`/`scoop`/`curl`/`yarn`, but these are irrelevant to our distribution. Upstream changes to non-npm installation paths can be accepted as-is — they have no effect on DevEco Code auto-upgrade. The CLI `deveco upgrade --method` already limits choices to `["npm", "pnpm", "bun"]` (`packages/opencode/src/cli/cmd/upgrade.ts:20`).
