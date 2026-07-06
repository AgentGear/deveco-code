# Live E2E Test Cases

This document is the case map for live end-to-end tests. These tests may use the real local Huawei DevEco login and call the real LLM provider.

| ID | Name | Category | Priority | Requirements | Code |
|---|---|---|---|---|---|
| `LLM_BASIC_TEXT` | 真实登录态下普通消息返回文本 | `llm` | `P0` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/llm-basic-text.case.ts` |

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

