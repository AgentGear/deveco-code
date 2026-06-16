# AGENTS.md

- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.

## Commits and PR Titles

Use conventional commit-style messages and PR titles: `type(scope): summary`.

Valid types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`. Scopes are optional; use the affected package or area when helpful, e.g. `core`, `opencode`, `tui`, `app`, `desktop`, `sdk`, or `plugin`.

Examples: `fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`, `chore(sdk): regenerate types`.

## Style Guide

**A single task may match multiple rows — always read all matching documents before proceeding.**

| When you need to... | Read this |
|---------------------|-----------|
| Understand the project layout or find where a package lives | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Look up feature specs, or keep feature docs in sync with code changes | [specs/FEATURES-INDEX.md](./specs/FEATURES-INDEX.md) |
| Write or review code (style, patterns, testing rules — **code style only**; branch/process conventions follow other docs in this table) | [OPENCODE-AGENTS.md](./OPENCODE-AGENTS.md) |
| Development workflow, branch strategy, commit conventions, and PR process | [DEV-WORKFLOW.md](./DEV-WORKFLOW.md) |
| Release workflow, versioning, and hotfix procedures | [RELEASE-WORKFLOW.md](./RELEASE-WORKFLOW.md) |
| Sync changes from the upstream OpenCode repo | [.agents/skills/upstream-sync/SKILL.md](./.agents/skills/upstream-sync/SKILL.md) |
| Check the upstream OpenCode baseline tag version | [.agents/upstream-sync/BASELINE.md](./.agents/upstream-sync/BASELINE.md) |
