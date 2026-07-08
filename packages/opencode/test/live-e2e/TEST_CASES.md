# Live E2E Test Cases

This document is the case map for live end-to-end tests. These tests may use the real local Huawei DevEco login and call the real LLM provider.

| ID | Name | Category | Priority | Requirements | Code |
|---|---|---|---|---|---|
| `LLM_BASIC_TEXT` | 真实登录态下普通消息返回文本 | `llm` | `P0` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/llm-basic-text.case.ts` |
| `PLAN_MODE_ENTER` | 切换到plan模式 | `slash` | `P0` | `huawei-auth`, `real-llm` | `cases/plan-mode-enter.case.ts` |
| `PROJECT_CREATE_DEFAULT_API` | 参数完整，无自定义apiLevel | `skill` | `P0` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/project-create-default-api.case.ts` |
| `CONFIG_THIRD_PARTY_MODELS` | 在deveco.jsonc中配置三方模型 | `cli` | `P1` | `huawei-auth` | `cases/config-third-party-models.case.ts` |

## LLM_BASIC_TEXT

Purpose:

Verify that the source CLI can read the local Huawei DevEco OAuth credential, inject the DevEco provider, send a normal prompt, and receive real LLM text.

Steps:

1. Create a temporary workspace.
2. Run `deveco run --format json --dir <tmp>`.
3. Send `Reply with exactly this text and nothing else: LIVE_TEST_OK`.
4. Parse JSON-line events from stdout.
5. Collect the text events and session id.

Expected result:

1. The process exits with code `0`.
2. At least one `text` event is emitted.
3. The received text contains `LIVE_TEST_OK`.

Cleanup:

The temporary workspace is deleted after execution. The user's real DevEco auth and config files are read-only and are not cleaned or modified by this case.

## CONFIG_THIRD_PARTY_MODELS

Purpose:

Verify that third-party models configured in deveco.jsonc at different hierarchy levels (global `~/.deveco`, project root, project `.deveco`) are correctly visible via `deveco models`: all levels are visible inside the project that defines them, while only the global level is visible in a different project.

Steps:

1. Create a temporary user home directory and write `.deveco/deveco.jsonc` with third-party model A.
2. Create a temporary project A workspace and write `deveco.jsonc` at the project root with third-party model B.
3. Write `.deveco/deveco.jsonc` inside project A with third-party model C.
4. Create a temporary project B workspace with no project-level config.
5. Run `deveco models` in project A root directory.
6. Run `deveco models` in project B root directory.

Expected result:

1. Step 5 output contains models A, B, and C (in `provider/model` format).
2. Step 6 output contains only model A; it does NOT contain model B or model C.

Cleanup:

All temporary directories (temp home, temp config home, project A, project B) are deleted after execution. The user's real auth and config files are not modified.

## PLAN_MODE_ENTER

Purpose:

Verify that switching to plan mode via --agent plan parameter works correctly, sends a mode confirmation request, and receives real LLM response confirming plan mode.

Steps:

1. Create a temporary workspace.
2. Run `deveco run --agent plan --format json --dir <tmp>`.
3. Send `你是什么模式？`.
4. Parse JSON-line events from stdout.
5. Verify agent switching events and text responses.

Expected result:

1. The process exits with code `0`.
2. At least one `text` event is emitted.
3. The received text contains plan-related keywords (计划, plan).
4. Agent switching events may be present.

Cleanup:

The temporary workspace is deleted after execution. The user's real DevEco auth and config files are read-only and are not cleaned or modified by this case.

## PROJECT_CREATE_DEFAULT_API

Purpose:

Verify that the source CLI can create a HarmonyOS project from a natural-language prompt without specifying a custom apiLevel. The system should auto-detect the SDK apiLevel, create the project, emit complete output, generate `build-profile.json5`, and switch the session cwd to the new project directory.

Steps:

1. Create a temporary workspace.
2. Run `deveco run --format json --dir <tmp>`.
3. Send the prompt: "请在当前工作目录从0到1生成一个名为HelloWorld的鸿蒙应用，提供一个简洁的HelloWorld页面，最后完成编译并尝试运行，如受环境限制请明确说明原因".
4. Parse JSON-line events from stdout (tolerating truncated lines from a process killed mid-stream).
5. Find the `bash` tool event that ran `copy-template` with `status: "completed"`, and verify the command does not contain `--api-level`.
6. Parse the `copy-template` output JSON and verify it contains complete project info (`projectRoot`, `appName`, `bundleName`, `apiLevel`, `source`).
7. Verify `source` is `sdk_pkg` (auto-detected) and `verified` is `true`.
8. Verify `build-profile.json5` exists on disk at the `projectRoot`.
9. Verify cwd was switched: either the `copy-template` output contains `Session directory auto-switched` or a `switch_cwd` tool event with `status: "completed"` exists.

Expected result:

1. A completed `copy-template` bash tool event is found, with `verified: true` in the output.
2. The output contains complete project info including `projectRoot`, `appName`, `bundleName`, `apiLevel`, and `source`.
3. `build-profile.json5` exists in the project directory.
4. cwd was switched (auto-switch message or `switch_cwd` tool event).

Cleanup:

The temporary workspace is deleted after execution. The user's real DevEco auth and config files are read-only and are not cleaned or modified by this case.
