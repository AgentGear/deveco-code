---
name: arkts-runtime-fix
description: Triage and fix ArkTS or JavaScript runtime crashes. MUST load this skill immediately when the user provides jscrash logs, uncaught exceptions, or runtime stack traces.
---

# Harmony JSCrash Fixes

Use this skill to diagnose and fix ArkTS or JavaScript runtime crashes with minimal edits.

Prefer the built-in `jscrash_report` tool first when the user already provided a crash log, or when recent device hilog is enough to establish a crash anchor.
This skill also includes private Bun scripts under `skills/arkts-runtime-fix/scripts/` for more targeted parsing and faultlogger workflows when `jscrash_report` is not enough.

If `bun` is unavailable, stop and explain that the private scripts cannot run.

## When To Load

Load this skill when the issue looks like one of these:

- Runtime logs show `TypeError`, `ReferenceError`, `RangeError`, `SyntaxError`, `BusinessError`, or similar exceptions.
- The app exits, flashes back, or white-screens during launch or after a tap.
- The user provides a `jscrash` log, stack trace, or a temporary log file with `@file`.
- Build succeeds, but runtime behavior fails immediately.

## Core Approach

Prefer a concrete crash anchor before broad code exploration. A good anchor can come from:

- a provided crash log
- a stack trace
- a clear page or module named by the user
- a recent device-side faultlog or hilog when no better evidence is available

Avoid broad `Read` / `Glob` / `Explore` across the whole project until you have at least one concrete anchor such as:

- `error_type`
- `error_message`
- `suspected_file`
- `top_stack`
- or a clearly named crash entry point from the user

Do not over-collect logs. If the user already gave enough crash evidence, parse that evidence first and move into focused reading and minimal fixes.

## Tool And Script Contract

### Preferred built-in tool

Use `jscrash_report` first in the common cases below:

- the user pasted raw crash text
- the user only needs a quick suspected file / top stack summary
- recent device hilog is enough and faultlogger inspection is not necessary yet

Typical calls:

```text
jscrash_report(crash_log="<raw crash text>", bundle_name="<bundleName>")
jscrash_report(device_id="<deviceId>", bundle_name="<bundleName>")
```

If the built-in tool returns a weak anchor or you need faultlogger-specific evidence, fall back to the private scripts below.

### Private Bun scripts

Run the private scripts through Shell like this:

```bash
bun "{SKILL_DIR}/scripts/<script>.ts" ...
```

`{SKILL_DIR}` is the absolute path of this skill directory at runtime.

Scripts print stable `key: value` text to stdout. A non-zero exit code means the current step could not continue and the agent should report the reason instead of guessing.

## Preferred Flows

### Case A: The user already provided raw crash text

Prefer `jscrash_report` first. If you still need the private parser output contract, run:

```bash
bun "{SKILL_DIR}/scripts/parse-jscrash-log.ts" --log-text "{crashLog}" --bundle-name "{bundleName}" --include-text
```

### Case B: The user provided `@file` or a local log path

If `jscrash_report` cannot consume the file path directly, use the private parser:

```bash
bun "{SKILL_DIR}/scripts/parse-jscrash-log.ts" --log-file "{logFilePath}" --bundle-name "{bundleName}" --include-text
```

### Case C: The user only described symptoms and did not provide logs

Log collection is optional here. Use it when you still need a concrete runtime anchor.

Prefer `jscrash_report(device_id=..., bundle_name=...)` first if a recent hilog snapshot is likely enough.

Prefer recent faultlogger evidence first:

```bash
bun "{SKILL_DIR}/scripts/probe-faultlogger.ts" --bundle-name "{bundleName}" --device-id "{deviceId}" --max-age-minutes "30" --limit "10"
```

If `status: found`, fetch and parse the latest faultlog:

```bash
bun "{SKILL_DIR}/scripts/fetch-faultlog.ts" --faultlog-name "{latestFaultlog}" --device-id "{deviceId}" --output-dir "{tempDir}"
bun "{SKILL_DIR}/scripts/parse-jscrash-log.ts" --log-file "{localFaultlogPath}" --bundle-name "{bundleName}" --source file --include-text
```

If faultlogger is unavailable, empty, or still not enough, you may fall back to hilog:

```bash
bun "{SKILL_DIR}/scripts/collect-hilog.ts" --device-id "{deviceId}" --lines "4000" --output-dir "{tempDir}"
bun "{SKILL_DIR}/scripts/parse-jscrash-log.ts" --log-file "{hilogPathFromCollect}" --bundle-name "{bundleName}" --source hilog --include-text
```

## Output Contract

The leading `key: value` block from `parse-jscrash-log.ts` includes:

- `status`: `detected` | `no_crash_signature` | `parse_failed`
- `source`: `file` | `text` | `hilog` and similar sources
- `error_type`
- `error_message`
- `suspected_file`
- `top_stack`: `|`-joined frames
- `keywords`: comma-separated
- `next_action`

`--include-text` appends a human-readable summary after the structured block.

If `status: no_crash_signature`, explain that the evidence is weak and ask for a better log, clearer repro, or an additional runtime clue before broad code reading.

## Common Crash Signatures

| Signature | Typical Cause | First Fix Direction |
|---|---|---|
| `TypeError` on property access | Null or undefined state during render or lifecycle | Guard null state, initialize earlier, or move logic to a safer lifecycle |
| `ReferenceError` | Wrong scope, stale import, missing symbol | Fix symbol ownership, import path, or callback capture |
| `RangeError` | Invalid index, recursion loop, oversized access | Add bounds checks, break loops, clamp indexes |
| `BusinessError` / `ParameterError` | Framework API preconditions not met | Validate args, permissions, or call timing |

## Interpretation Rules

- Prefer application frames over framework noise.
- Treat the first concrete `.ets`, `.ts`, or `.js` path as the starting point, not the final truth.
- If the user gave repro steps, trust them over a simplistic stack-only guess.
- If the stack points to a non-entry page, assume an interaction-triggered path unless evidence proves a cold-start crash.
- Do not refactor broadly. Fix the crash path first.

## Conversational Shape

1. Say what evidence you already have.
2. If logs are missing, say whether you are using `jscrash_report`, faultlogger, or hilog to get a better anchor.
3. Once you have an anchor, switch into focused code reading and minimal fixing.

## Constraints

- Never claim a crash fix from prompt reasoning alone.
- Never replace a root-cause fix with retries, arbitrary delays, or broad defensive rewrites.
- If unfamiliar `@ohos.*` or `@kit.*` APIs are involved, check their constraints before editing.
- This skill does not decide the final compile / run / verification order; the primary agent owns that.
