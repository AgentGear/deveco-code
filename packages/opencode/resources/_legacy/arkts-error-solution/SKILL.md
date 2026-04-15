---
name: arkts-error-solution
description: "Check and fix ArkTS syntax errors in HarmonyOS projects and automate the build process. Use this skill when you need to compile a project, resolve compilation errors, or generate HAP/App artifacts. It provides a complete workflow including static syntax checks, automated error fixing, and repeated builds until success. It also supports error priority classification (P0/P1/P2), maximum retry control, and automatic build artifact discovery."
license: MIT
---

# HarmonyOS Project Automated Build

## Skill Overview

This skill is dedicated to automated HarmonyOS project builds. It combines static syntax checks, error fixing, and iterative build execution to ensure the project can compile successfully and produce output artifacts.

## Use Cases

- ✅ Compile a HarmonyOS project and generate HAP/App artifacts
- ✅ Fix syntax errors that already exist in the project
- ✅ Run an automated build workflow with reduced manual intervention
- ✅ Support continuous integration and continuous delivery scenarios
- ✅ Build a project for the first time or after an upgrade

## Workflow

### Core Flowchart

```
Start
  │
  ├─→ Step 0: Check Harmony tool availability
  │     ├─→ Tools available → continue
  │     └─→ Tools unavailable → explain environment issue → stop
  │
  ├─→ Step 1: Scan project source files
  │     └─→ Get the list of all .ets files
  │
  ├─→ Step 2: Build project
  │     └─→ build_project
  │
  ├─→ Step 3: Analyze diagnostics
  │     ├─→ Errors found → Step 4: Fix errors
  │     └─→ No errors → Step 5: Start app
  │
  ├─→ Step 4: Fix errors
  │     ├─→ Apply fixes
  │     └─→ Return to Step 2 for re-checking
  │
  ├─→ Step 5: Start app
  │     └─→ start_app
  │
  ├─→ Step 6: Check launch result
  │     ├─→ Launch failed → analyze errors → Step 4
  │     └─→ Launch succeeded → Step 7
  │
  └─→ Step 7: Output build artifacts
       └─→ Done
```

### Detailed Execution Steps

#### 0. Check Harmony Tool Availability

**⚠️ Important: This skill depends on Harmony build/check tools being available**

Before performing any build action, first confirm that the required Harmony tools are callable in the current session.

**Required tools**:
- `build_project` - project build
- `start_app` - launch the app after a successful build

**Useful related tools**:
- `verify_ui` - validate UI flows after the build succeeds
- `get_ui_verification_log` - collect runtime logs tied to a UI verification run

**How to check**:
```
Try calling `build_project`.
If the tool is unavailable, an error message will be returned.
```

This is an environment preflight step, not a separate repair loop. The goal is to fail fast when the current session cannot run Harmony build/check actions.

**If the tools are not available**:

```
❌ Harmony build/check tools are not available in the current session

This skill cannot continue until the Harmony tool environment is available.

Typical causes:

- the Harmony tool integration is not enabled for this session
- DevEco / Harmony dependencies are missing or not configured
- the current session context is not pointed at a valid Harmony project

What to do next:

- verify the current project root is correct
- verify the required Harmony tools are exposed in this environment
- verify DevEco / Harmony SDK paths are configured correctly
- if your setup still uses an MCP-based integration, restore that integration and retry

After the environment issue is fixed, restart this skill flow from Step 0.
```

**Continue to the next steps only after the availability check passes.**

---

#### 1. Project Analysis

First analyze the project structure and configuration.

**Key config files**:
- `build-profile.json5` - project-level build configuration
- `entry/build-profile.json5` - module-level build configuration
- `module.json5` - module configuration
- `oh-package.json5` - dependency configuration

#### 2. Get the Source File List

Use the `Glob` tool to search for ETS files in the project:

```bash
# Search all .ets files
**/*.ets

# Exclude directories
- oh_modules/
- build/
- .preview/
```

#### 3. Build the Project

Use the tool to build the project:

```
build_project
Parameters:
  - build_intent: "LogVerification" | "UIDebug" | "PerformanceProfile" | "Release"
  - product: "default" (optional)
  - module: "entry@default" (optional)
  - clean: true | false (optional)
```

**Build target selection**:
- `hap` - generate a single HAP package for testing or debugging
- `app` - generate an APP package for release

#### 4. Error Fixing Strategy

Apply different strategies based on the error type:

**P0 - Must fix (blocks compilation)**:
- Syntax errors: missing semicolons, unmatched brackets
- Type errors: type mismatch
- Undefined variables or functions
- Import errors

**P1 - Strongly recommended to fix**:
- Deprecated APIs: find replacement APIs and apply migration changes

**P2 - Optional optimization**:
- Unused variables: remove them or prefix with `_`
- Exception handling: add `try-catch`

**Detailed fixing examples**: see [error-fixing-examples.md](references/error-fixing-examples.md)

#### 5. Start the App

After `build_project` succeeds, run:

```
start_app
```

**Rules**:
- Never run `start_app` before a successful `build_project`
- If the code changed again, rerun `build_project` before rerunning `start_app`
- If multiple devices are available, select the correct target before launching

#### 6. Handle Build Or Launch Errors

If the build fails, analyze the error message:

**Common build errors**:
1. **Dependency issue**: `Error: Cannot find module '@ohos/xxx'` → install dependencies
2. **Resource issue**: `Error: Resource not found` → check resource files
3. **Signing issue**: `Error: Signing failed` → check signing configuration
4. **Compilation issue**: `Error: ArkTS compiler error` → return to Step 2 for re-checking
5. **Launch issue**: app does not start or target device selection fails → verify target and rerun `start_app`

#### 7. Output Build Artifacts

After a successful build, the artifacts are typically located at:

```
project-root/
├── entry/build/default/outputs/default/entry-default-signed.hap
└── build/outputs/default/{project-name}-default-signed.app
```

**Output examples**: see [output-examples.md](references/output-examples.md)

## Iterative Fix Loop

### Decision Tree

```
Start build flow
│
├─ Are Harmony tools available?
│   ├─ No → explain environment issue → stop
│   └─ Yes → continue
│
├─ Build result?
│   ├─ Success → start app
│   │   ├─ Launch success → output artifact paths → done
│   │   └─ Launch failure → analyze launch issue → fix → rebuild
│   │
│   └─ Failure → what kind of error?
│       ├─ Dependency issue → install dependencies → rebuild
│       ├─ Signing issue → request manual fix → stop
│       ├─ Resource issue → check resource files → rebuild
│       └─ Compilation issue → fix code → rebuild
│
└─ Retry count > 5?
    ├─ Yes → stop and output a failure report
    └─ No → continue the loop
```

### Maximum Retry Count

To avoid infinite loops, enforce a retry limit:

```javascript
const MAX_RETRY_COUNT = 5;
let retryCount = 0;

while (retryCount < MAX_RETRY_COUNT) {
  const buildResult = await buildProject();
  
  if (buildResult.success) {
    const startResult = await startApp();
    
    if (startResult.success) {
      return { success: true, output: buildResult.output };
    }
  } else {
    await fixErrors(buildResult.errors);
  }
  
  retryCount++;
}

return { success: false, error: 'Max retry count exceeded' };
```

### Error Fixing Priority

In each iteration, fix issues in this order:

1. **P0 errors** - must be fixed or the project cannot compile
2. **P1 errors** - strongly recommended because they may affect functionality
3. **P2 errors** - optional optimizations that do not block compilation

### Skip Strategy

Some issues can be skipped:
- Permission warnings, if permissions are already configured correctly
- Unused variables, if they do not affect compilation
- Exception-handling suggestions, if treated as optional optimization

## Execution Checklist

### Pre-checks
- [ ] **Verify Harmony tool availability (required)**
- [ ] Confirm that the project path is correct
- [ ] Check `build-profile.json5` configuration
- [ ] Confirm SDK version compatibility
- [ ] Check whether dependencies are installed

### Build Flow
- [ ] Get the full ETS file list
- [ ] Execute the build command
- [ ] Analyze and fix errors
- [ ] Verify the build result
- [ ] Run `start_app`
- [ ] Verify the launch result
- [ ] Output the artifact paths

### Post-processing
- [ ] Record build logs
- [ ] Count the number of issues fixed
- [ ] Provide build artifact details

## Tool Reference

### Harmony Tools

| Tool Name | Purpose | Required Parameters |
|---------|------|---------|
| `build_project` | build the project and export artifacts | module?: string, product?: string, build_intent?: string, clean?: boolean |
| `start_app` | launch the built app on a device or emulator | hvd?: string, module?: string, target?: string |
| `verify_ui` | run a described UI verification flow | testPlan: string |
| `get_ui_verification_log` | fetch logs from a `verify_ui` run | id: string |

### Helper Tools

| Tool Name | Purpose |
|---------|------|
| `Glob` | search files |
| `Read` | read file contents |
| `Write` | write file contents |
| `SearchReplace` | edit files |

## Best Practices

### ✅ Recommended

1. **Incremental build**: prefer incremental builds to improve speed
2. **Parallel checks**: check multiple files in parallel when possible
3. **Error classification**: fix errors by priority
4. **Logging**: record the content of each fix
5. **Version control**: create a backup or commit before fixing

### ❌ Avoid

1. Do not ignore P0-level errors
2. Do not retry forever; keep a limit
3. Do not skip the build step and jump directly to app launch
4. Do not modify code blindly during the build process
5. Do not run `start_app` before `build_project` succeeds

## Notes

- ⚠️ **This skill depends on Harmony build/check tools being available in the current session.**
- ⚠️ Make sure the project path is correct, so you do not build the wrong project
- ⚠️ It is recommended to commit code before building, so rollback is easier
- ⚠️ Some errors require manual fixes and cannot be handled automatically
- ⚠️ Build time depends on project size and complexity
- ⚠️ Signing configuration requires certificate files to be prepared in advance

## Related Resources

### Reference Documents
- [Error Fixing Examples](references/error-fixing-examples.md) - detailed code examples for error fixes
- [Output Examples](references/output-examples.md) - examples of successful and failed build outputs

### External Resources
- [DevEco MCP Server Installation Guide](https://github.com/open-deveco/deveco-toolbox)
- [Feishu Guide](https://my.feishu.cn/wiki/open-deveco/deveco-toolbox)
- [HarmonyOS Build Guide](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-build-app)
- [ArkTS Compiler](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-get-started)
- [HAP Package Structure](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/hap-package)
- [Application Signing Configuration](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-signing)
