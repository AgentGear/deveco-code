# Live E2E Test Suite

This suite runs opt-in live end-to-end tests for DevEco Code. It is separate from normal unit tests because it can use the real local Huawei DevEco login and call the real LLM provider.

## Run All Cases

From `packages/opencode`:

```bash
DEVECO_LIVE_LLM=1 bun run test:live-e2e
```

The report is generated at:

```text
../../reports/live-e2e/latest/index.html
```

The terminal output shows the suite summary first, then one line per case.

## Run One Case

```bash
DEVECO_LIVE_LLM=1 bun run test:live-e2e --case LLM_BASIC_TEXT
```

## List Cases

```bash
bun run test:live-e2e --list
```

## Run By Category

```bash
DEVECO_LIVE_LLM=1 bun run test:live-e2e --category llm
```

## Preconditions

The source CLI must be able to read a real DevEco OAuth credential:

```bash
bun run --conditions=browser src/index.ts auth list
```

Expected output should include `DevEco Code` and `oauth`.

If it does not, log in with:

```bash
bun run --conditions=browser src/index.ts auth login --provider deveco
```

## Report Files

Each run resets `reports/live-e2e/latest/` and writes:

- `index.html`: clickable human-readable report.
- `summary.md`: compact Markdown summary.
- `summary.json`: machine-readable report data.
- `artifacts/*.log` and `artifacts/*.jsonl`: per-case stdout, stderr, and event streams.

## Add A New Case

1. Create a file under `test/live-e2e/cases/`, for example `llm-tool-call.case.ts`.
2. Export a `LiveTestCase` object with a unique `id`.
3. Register it in `test/live-e2e/registry.ts`.
4. Add a row and section in `test/live-e2e/TEST_CASES.md`.
5. Run only the new case:

```bash
DEVECO_LIVE_LLM=1 bun run test:live-e2e --case YOUR_CASE_ID
```

## Case Requirements

Use `requires` to declare runtime dependencies:

- `huawei-auth`: requires local Huawei DevEco OAuth login.
- `real-llm`: requires `DEVECO_LIVE_LLM=1`.
- `deveco-provider`: requires DevEco provider injection from the OAuth credential.

The runner skips cases with unmet requirements and records the reason in the report.

## Isolation And Cleanup

Cases should be independent by default.

Rules:

- Create a temporary workspace per case.
- Do not depend on a previous case's session or files.
- Write diagnostics through `ctx.writeArtifact`.
- Delete temporary workspaces after the case.
- Do not delete or modify the user's real `auth.json`, config, token files, or provider credentials.

The runner reads real auth/config only because live LLM verification explicitly needs that path.
