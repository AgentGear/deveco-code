# Live E2E Test Cases

This document is the case map for live end-to-end tests. These tests may use the real local Huawei DevEco login and call the real LLM provider.

| ID | Name | Category | Priority | Requirements | Code |
|---|---|---|---|---|---|
| `LLM_BASIC_TEXT` | 真实登录态下普通消息返回文本 | `llm` | `P0` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/llm-basic-text.case.ts` |
| `PLAN_MODE_ENTER` | 切换到plan模式 | `slash` | `P0` | `huawei-auth`, `real-llm` | `cases/plan-mode-enter.case.ts` |
| `PROJECT_CREATE_DEFAULT_API` | 参数完整，无自定义apiLevel | `skill` | `P0` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/project-create-default-api.case.ts` |

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
