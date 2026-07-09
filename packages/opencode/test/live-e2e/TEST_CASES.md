# Live E2E Test Cases

This document is the case map for live end-to-end tests. These tests may use the real local Huawei DevEco login and call the real LLM provider.

| ID | Name | Category | Priority | Requirements | Code |
|---|---|---|---|---|---|
| `LLM_BASIC_TEXT` | 真实登录态下普通消息返回文本 | `llm` | `P0` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/llm-basic-text.case.ts` |
| `PLAN_MODE_ENTER` | 切换到plan模式 | `slash` | `P0` | `huawei-auth`, `real-llm` | `cases/plan-mode-enter.case.ts` |
| `PROJECT_CREATE_DEFAULT_API` | 参数完整，无自定义apiLevel | `skill` | `P0` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/project-create-default-api.case.ts` |
| `CONFIG_THIRD_PARTY_MODELS` | 在deveco.jsonc中配置三方模型 | `cli` | `P1` | `huawei-auth` | `cases/config-third-party-models.case.ts` |
| `SKILL_ERROR_INVALID_IMPORT` | 无效引用修复 | `skill` | `P1` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/skill-error-invalid-import.case.ts` |
| `SKILL_ERROR_TYPE_MISMATCH` | 类型错误修复 | `skill` | `P1` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/skill-error-type-mismatch.case.ts` |
| `SKILL_ERROR_SYNTAX_BRACKET` | 语法错误修复 | `skill` | `P1` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/skill-error-syntax-bracket.case.ts` |
| `SKILL_GRAMMAR_DIFF_QUERY` | 差异点查询 | `skill` | `P1` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/skill-grammar-diff-query.case.ts` |
| `SKILL_GRAMMAR_CLASS_DEF` | 正确语法查询 | `skill` | `P1` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/skill-grammar-class-def.case.ts` |
| `SKILL_GRAMMAR_TS_TO_ARKTS` | 错误代码修复 | `skill` | `P1` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/skill-grammar-ts-to-arkts.case.ts` |
| `SKILL_ARKUI_BASIC_COMPONENT` | 基础组件使用 | `skill` | `P1` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/skill-arkui-basic-component.case.ts` |
| `SKILL_ARKUI_COMPLEX_LAYOUT` | 复杂布局实现 | `skill` | `P1` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/skill-arkui-complex-layout.case.ts` |
| `SKILL_DEVECO_CREATE_HELLO_WORLD` | 0-1构建项目 | `skill` | `P1` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/skill-deveco-create-hello-world.case.ts` |
| `SKILL_DEVECO_API17_FALLBACK` | SDK选择推荐 | `skill` | `P1` | `huawei-auth`, `real-llm`, `deveco-provider` | `cases/skill-deveco-api17-fallback.case.ts` |

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

## SKILL_ERROR_INVALID_IMPORT

Purpose:

Verify that selecting the arkts-error-fixes skill via /skill and inputting code with an unimported router module produces a fix that includes `import router from 'ohos.router'`.

Steps:

1. Create a temporary workspace.
2. Run `deveco run --format json --dir <tmp> --command arkts-error-fixes` with code referencing `router.pushUrl` without importing the router module.
3. Parse JSON-line events from stdout.
4. Verify text events contain `import`, `router`, and `ohos.router`.

Expected result:

1. At least one text event is emitted.
2. The response contains `import router` and `ohos.router` fix suggestion.

Cleanup:

The temporary workspace is deleted after execution. The user's real DevEco auth and config files are read-only and are not cleaned or modified by this case.

## SKILL_ERROR_TYPE_MISMATCH

Purpose:

Verify that selecting the arkts-error-fixes skill via /skill and inputting code with a type error (`let num: number = "hello"`) produces a type or value fix suggestion.

Steps:

1. Create a temporary workspace.
2. Run `deveco run --format json --dir <tmp> --command arkts-error-fixes` with `let num: number = "hello"`.
3. Parse JSON-line events from stdout.
4. Verify text events contain type fix suggestion (string/number/类型).

Expected result:

1. At least one text event is emitted.
2. The response contains a type correction suggestion mentioning string or number.

Cleanup:

The temporary workspace is deleted after execution. The user's real DevEco auth and config files are read-only and are not cleaned or modified by this case.

## SKILL_ERROR_SYNTAX_BRACKET

Purpose:

Verify that selecting the arkts-error-fixes skill via /skill and inputting component code with a missing closing brace produces a fix that identifies the missing `}`.

Steps:

1. Create a temporary workspace.
2. Run `deveco run --format json --dir <tmp> --command arkts-error-fixes` with component code missing a closing `}`.
3. Parse JSON-line events from stdout.
4. Verify text events mention the missing `}` bracket.

Expected result:

1. At least one text event is emitted.
2. The response identifies the missing closing brace and provides a fix.

Cleanup:

The temporary workspace is deleted after execution. The user's real DevEco auth and config files are read-only and are not cleaned or modified by this case.

## SKILL_GRAMMAR_DIFF_QUERY

Purpose:

Verify that selecting the arkts-grammar-standards skill via /skill and asking about ArkTS vs TS function declaration differences returns a clear difference explanation (e.g., mandatory type declarations).

Steps:

1. Create a temporary workspace.
2. Run `deveco run --format json --dir <tmp> --command arkts-grammar-standards` with the question "ArkTS和TS在函数声明上有什么不同？".
3. Parse JSON-line events from stdout.
4. Verify text events contain type declaration and function difference explanations.

Expected result:

1. At least one text event is emitted.
2. The response mentions type declarations and function differences.

Cleanup:

The temporary workspace is deleted after execution. The user's real DevEco auth and config files are read-only and are not cleaned or modified by this case.

## SKILL_GRAMMAR_CLASS_DEF

Purpose:

Verify that selecting the arkts-grammar-standards skill via /skill and asking how to define a class in ArkTS returns a code snippet containing `class` and key point explanations.

Steps:

1. Create a temporary workspace.
2. Run `deveco run --format json --dir <tmp> --command arkts-grammar-standards` with the question "ArkTS中如何定义一个类？".
3. Parse JSON-line events from stdout.
4. Verify text events contain `class` keyword and ArkTS code.

Expected result:

1. At least one text event is emitted.
2. The response contains `class` keyword and ArkTS code snippet.

Cleanup:

The temporary workspace is deleted after execution. The user's real DevEco auth and config files are read-only and are not cleaned or modified by this case.

## SKILL_GRAMMAR_TS_TO_ARKTS

Purpose:

Verify that selecting the arkts-grammar-standards skill via /skill and providing TypeScript code returns equivalent ArkTS code.

Steps:

1. Create a temporary workspace.
2. Run `deveco run --format json --dir <tmp> --command arkts-grammar-standards` with a TS-to-ArkTS conversion request.
3. Parse JSON-line events from stdout.
4. Verify text events contain ArkTS equivalent code.

Expected result:

1. At least one text event is emitted.
2. The response contains ArkTS code with type declarations, class, or function.

Cleanup:

The temporary workspace is deleted after execution. The user's real DevEco auth and config files are read-only and are not cleaned or modified by this case.

## SKILL_ARKUI_BASIC_COMPONENT

Purpose:

Verify that selecting the arkui-knowledge skill via /skill and asking how to create a Text component with red font color returns code containing `Text('你好').fontColor(Color.Red)` or equivalent.

Steps:

1. Copy arkui-knowledge skill from opencode config to deveco data directory if not already present.
2. Create a temporary workspace.
3. Run `deveco run --format json --dir <tmp> --command arkui-knowledge` with the question about Text component with red font color.
4. Parse JSON-line events from stdout.
5. Verify text events contain `Text(`, `fontColor`, and red color reference.
6. Clean up copied skill and temporary workspace.

Expected result:

1. At least one text event is emitted.
2. The response contains `Text(`, `fontColor`, and `Color.Red` or `red`.

Cleanup:

The temporary workspace and any copied skill files are deleted after execution. The user's real DevEco auth and config files are read-only and are not cleaned or modified by this case.

## SKILL_ARKUI_COMPLEX_LAYOUT

Purpose:

Verify that selecting the arkui-knowledge skill via /skill and requesting a vertical layout with an image and a button returns a complete example using `Column`, `Image`, and `Button` components.

Steps:

1. Copy arkui-knowledge skill from opencode config to deveco data directory if not already present.
2. Create a temporary workspace.
3. Run `deveco run --format json --dir <tmp> --command arkui-knowledge` with a layout request.
4. Parse JSON-line events from stdout.
5. Verify text events contain `Column`, `Image`, and `Button` components.
6. Clean up copied skill and temporary workspace.

Expected result:

1. At least one text event is emitted.
2. The response contains `Column`, `Image`, and `Button` in a complete layout example.

Cleanup:

The temporary workspace and any copied skill files are deleted after execution. The user's real DevEco auth and config files are read-only and are not cleaned or modified by this case.

## SKILL_DEVECO_CREATE_HELLO_WORLD

Purpose:

Verify that selecting the deveco-create-project skill via /skill and requesting a hello world project with compilation loads the create-project skill, copies the initial project template, calls build_project, and fixes any build issues until compilation succeeds.

Steps:

1. Create a temporary workspace.
2. Run `deveco run --format json --dir <tmp> --command deveco-create-project` with the prompt "帮我生成一个hello world工程，并完成编译".
3. Parse JSON-line events from stdout (tolerating truncated lines).
4. Find the `bash` tool event that ran `copy-template` with `status: "completed"` and `verified: true`.
5. Verify `build-profile.json5` exists on disk at the `projectRoot`.
6. Find `build_project` tool events and verify build was attempted.
7. Verify build succeeded or errors were fixed.

Expected result:

1. `copy-template` script executed successfully with `verified: true`.
2. `build-profile.json5` exists in the project directory.
3. `build_project` was called and build succeeded or was fixed.

Cleanup:

The temporary workspace is deleted after execution. The user's real DevEco auth and config files are read-only and are not cleaned or modified by this case.

## SKILL_DEVECO_API17_FALLBACK

Purpose:

Verify that selecting the deveco-create-project skill (supporting API18-22) via /skill and specifying API17 for project creation, the system recognizes API17 is not in the supported range, queries the SDK directory for a corresponding version, and if not found defaults to API22.

Steps:

1. Create a temporary workspace.
2. Run `deveco run --format json --dir <tmp> --command deveco-create-project` with the prompt specifying API 17.
3. Parse JSON-line events from stdout (tolerating truncated lines).
4. Find the `bash` tool event that ran `copy-template`.
5. Parse the `copy-template` output and verify API level info.
6. If API17 was rejected, verify the system fell back to SDK default or API22.
7. Verify `build-profile.json5` exists on disk at the `projectRoot`.

Expected result:

1. `copy-template` script was executed.
2. If API17 was out of range, the system fell back to SDK default or API22.
3. `build-profile.json5` exists in the project directory.

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
