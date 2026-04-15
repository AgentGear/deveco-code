---
name: deveco-create-project
description: Use the skill's private TypeScript script to create ArkTS projects reliably. Suitable for new project creation and empty directory initialization.
---

# deveco-create-project

Use the skill's private script to create an ArkTS project, instead of relying on the model to copy template files one by one.

## Required Parameters

Confirm the following parameters before execution. Ask the user if any required value is missing:

| Parameter | Required | Default | Example |
|------|---------|--------|------|
| `projectPath` | Required | — | `/Users/yellow/Desktop/projects` |
| `appName` | Required | — | `HelloWorld` |
| `bundleName` | Auto-derived, no need to ask | `com.example.{appName lowercase}` | `com.example.helloworld` |
| `apiLevel` | Optional | Auto-detect from DevEco SDK metadata, fallback to `22` | `21` |

If the user explicitly specifies an SDK/API level, pass it through directly.
If the user does not specify one, do not let the model invent a version. Let the script detect it using this fixed priority:

1. `DEVECO_HOME/sdk/default/sdk-pkg.json`
2. `DEVECO_HOME/sdk/default/openharmony/*/oh-uni-package.json`
3. fallback to `22`

## Execution Steps

> `copy-template.ts` reads the sibling skill directory `deveco-create-project/application/` as the template source by default.
> This script runs with Bun. If `bun` is not available in the environment, stop immediately and explain that to the user.
> Default skills are extracted to a local user skill directory before execution. Keep all scripts in this skill self-contained and do not import repo-only source files.

### Step 1: Run the Private Script

Run the following with Shell:

```bash
bun "{SKILL_DIR}/scripts/copy-template.ts" --project-path "{projectPath}" --app-name "{appName}" --bundle-name "{bundleName}" --api-level "{apiLevel}"
```

If `apiLevel` is not explicitly provided by the user, omit `--api-level` and let the script detect it from DevEco metadata.

Execution requirements:

- Do not manually copy template files one by one.
- Let the script handle recursive copying, binary asset copying, placeholder replacement, and basic validation.
- The script is responsible for SDK detection. Do not decide the SDK version in the prompt by guesswork.
- If the script exits with a non-zero code, report the error to the user and stop.

### Step 2: Verify the Result

At minimum, verify that the following file exists:

- `{projectPath}/{appName}/build-profile.json5`

If the file is missing, treat the creation as failed and do not proceed to later compile or page-generation steps.

### Step 3: Report Back to the User

Output:

- The absolute project path
- App name / bundle name / API Level
- `source` of the selected API level: `user_input` / `sdk_pkg` / `oh_uni_package` / `fallback`
- Whether the template integrity check passed

### Step 4: Switch Session Project Context (Required)

After project creation succeeds, call `switch_cwd` and set the target path to the generated project root (`{projectPath}/{appName}`).

Reason:

- `build_project` and `start_app` only work correctly when the current session context directory is the actual project root.
- This skill creates a full project under the current path; without switching context to that generated path, subsequent build/run actions may fail or target the wrong directory.
