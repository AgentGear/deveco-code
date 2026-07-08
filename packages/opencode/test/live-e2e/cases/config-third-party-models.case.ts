import type { LiveTestCase, RunCommandResult } from "../types"
import { cliEntry, opencodeRoot } from "../env"
import fs from "fs/promises"
import path from "path"

const CASE_ID = "CONFIG_THIRD_PARTY_MODELS"

const PROVIDER_A = "e2e-thirdparty-a"
const MODEL_A = "model-a"
const PROVIDER_B = "e2e-thirdparty-b"
const MODEL_B = "model-b"
const PROVIDER_C = "e2e-thirdparty-c"
const MODEL_C = "model-c"

const configA = {
  $schema: "https://opencode.ai/config.json",
  provider: {
    [PROVIDER_A]: {
      name: "E2E Third Party A",
      options: {
        baseURL: "https://e2e-test-a.example.com/v1",
        apiKey: "e2e-test-key-a",
      },
      models: {
        [MODEL_A]: {
          name: "Model A",
        },
      },
    },
  },
}

const configB = {
  $schema: "https://opencode.ai/config.json",
  provider: {
    [PROVIDER_B]: {
      name: "E2E Third Party B",
      options: {
        baseURL: "https://e2e-test-b.example.com/v1",
        apiKey: "e2e-test-key-b",
      },
      models: {
        [MODEL_B]: {
          name: "Model B",
        },
      },
    },
  },
}

const configC = {
  $schema: "https://opencode.ai/config.json",
  provider: {
    [PROVIDER_C]: {
      name: "E2E Third Party C",
      options: {
        baseURL: "https://e2e-test-c.example.com/v1",
        apiKey: "e2e-test-key-c",
      },
      models: {
        [MODEL_C]: {
          name: "Model C",
        },
      },
    },
  },
}

// Build env for the test:
// - DEVECO_CONFIG points to a temp file with model A (simulates global ~/.deveco config)
// - DEVECO_DISABLE_PROJECT_CONFIG is removed so project-level configs are loaded
// - Real user home/auth is preserved (no DEVECO_TEST_HOME override)
// - models.dev fetch disabled for deterministic output
function makeTestEnv(globalConfigPath: string): Record<string, string | undefined> {
  const env = { ...process.env }
  env.DEVECO_CONFIG = globalConfigPath
  delete env.DEVECO_DISABLE_PROJECT_CONFIG
  env.DEVECO_DISABLE_MODELS_FETCH = "1"
  env.DEVECO_DISABLE_AUTOUPDATE = "1"
  env.DEVECO_DISABLE_AUTOCOMPACT = "1"
  return env
}

// The `deveco models` command uses process.cwd() as the project directory.
// But bunfig.toml (with @opentui/solid/preload for JSX) lives in packages/opencode.
// Running from a temp cwd loses the bunfig.toml, causing JSX runtime errors.
// Solution: create a wrapper script that calls process.chdir(projectDir) then
// imports the CLI entry, and run it with cwd=opencodeRoot so bunfig.toml is found.
async function runDevecoModels(
  projectDir: string,
  env: Record<string, string | undefined>,
  timeoutMs = 120_000,
): Promise<RunCommandResult> {
  const cliEntryUrl = "file://" + cliEntry.replace(/\\/g, "/")
  const wrapperContent = `process.chdir(${JSON.stringify(projectDir)}); await import(${JSON.stringify(cliEntryUrl)});`
  const wrapperPath = path.join(projectDir, "e2e-wrapper.ts")
  await fs.writeFile(wrapperPath, wrapperContent)

  const start = Date.now()
  const proc = Bun.spawn(["bun", "run", "--conditions=browser", wrapperPath, "models"], {
    cwd: opencodeRoot,
    env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  })
  const timeout = setTimeout(() => proc.kill(), timeoutMs)
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]).finally(() => clearTimeout(timeout))
  return { exitCode, stdout, stderr, durationMs: Date.now() - start }
}

const testCase: LiveTestCase = {
  id: CASE_ID,
  title: "在deveco.jsonc中配置三方模型",
  category: "cli",
  priority: "P1",
  timeoutMs: 300_000,
  requires: ["huawei-auth"],
  description:
    "验证在deveco.jsonc配置文件不同层级（用户全局配置、项目根目录、项目.deveco目录）中配置的三方模型，通过deveco models命令查询时的可见性：在工程A中可查询到所有层级的模型，在工程B中仅可查询到全局配置的模型。",
  steps: [
    "创建临时全局配置文件（模拟用户~/.deveco/deveco.jsonc），添加三方模型A配置参数。",
    "创建鸿蒙工程A临时目录，在根目录deveco.jsonc中添加三方模型B配置参数。",
    "在鸿蒙工程A的.deveco/deveco.jsonc中添加三方模型C配置参数。",
    "创建鸿蒙工程B临时目录（无项目级配置）。",
    "在鸿蒙工程A根目录执行deveco models命令，查询可用模型列表。",
    "在鸿蒙工程B根目录执行deveco models命令，查询可用模型列表。",
  ],
  expected: [
    "步骤5输出包含三方模型A、B、C（provider/model格式）。",
    "步骤6输出仅包含三方模型A，不包含模型B和模型C。",
  ],
  code: "packages/opencode/test/live-e2e/cases/config-third-party-models.case.ts",
  parallel: false,
  cleanup:
    "用例创建临时全局配置文件和两个临时工程目录；执行结束后全部删除。不修改用户真实auth/config文件。",
  async run(ctx) {
    // Create a temp global config file with model A (simulates ~/.deveco/deveco.jsonc)
    const globalConfigDir = await ctx.createTempWorkspace("e2e-config-global-")
    const globalConfigPath = path.join(globalConfigDir, "deveco.jsonc")
    await fs.writeFile(globalConfigPath, JSON.stringify(configA, null, 2))

    // Create project A with model B (root config) and model C (.deveco config)
    const projectA = await ctx.createTempWorkspace("e2e-config-projectA-")
    await fs.writeFile(path.join(projectA, "deveco.jsonc"), JSON.stringify(configB, null, 2))
    const projectADevecoDir = path.join(projectA, ".deveco")
    await fs.mkdir(projectADevecoDir, { recursive: true })
    await fs.writeFile(path.join(projectADevecoDir, "deveco.jsonc"), JSON.stringify(configC, null, 2))

    // Create project B with no project-level config
    const projectB = await ctx.createTempWorkspace("e2e-config-projectB-")

    const env = makeTestEnv(globalConfigPath)
    const dirsToClean = [globalConfigDir, projectA, projectB]

    try {
      // Step 5: Run `deveco models` in project A
      const resultA = await runDevecoModels(projectA, env, 130_000)
      await ctx.writeArtifact(CASE_ID, "projectA-stdout.log", resultA.stdout)
      await ctx.writeArtifact(CASE_ID, "projectA-stderr.log", resultA.stderr)

      if (resultA.exitCode !== 0) {
        throw new Error(
          `deveco models in project A exited with ${resultA.exitCode}\nstderr: ${resultA.stderr}`,
        )
      }

      const expectedA = `${PROVIDER_A}/${MODEL_A}`
      const expectedB = `${PROVIDER_B}/${MODEL_B}`
      const expectedC = `${PROVIDER_C}/${MODEL_C}`

      if (!resultA.stdout.includes(expectedA)) {
        throw new Error(
          `Project A output should contain ${expectedA}.\nstdout:\n${resultA.stdout}`,
        )
      }
      if (!resultA.stdout.includes(expectedB)) {
        throw new Error(
          `Project A output should contain ${expectedB}.\nstdout:\n${resultA.stdout}`,
        )
      }
      if (!resultA.stdout.includes(expectedC)) {
        throw new Error(
          `Project A output should contain ${expectedC}.\nstdout:\n${resultA.stdout}`,
        )
      }

      // Step 6: Run `deveco models` in project B
      const resultB = await runDevecoModels(projectB, env, 130_000)
      await ctx.writeArtifact(CASE_ID, "projectB-stdout.log", resultB.stdout)
      await ctx.writeArtifact(CASE_ID, "projectB-stderr.log", resultB.stderr)

      if (resultB.exitCode !== 0) {
        throw new Error(
          `deveco models in project B exited with ${resultB.exitCode}\nstderr: ${resultB.stderr}`,
        )
      }

      if (!resultB.stdout.includes(expectedA)) {
        throw new Error(
          `Project B output should contain ${expectedA}.\nstdout:\n${resultB.stdout}`,
        )
      }
      if (resultB.stdout.includes(expectedB)) {
        throw new Error(
          `Project B output should NOT contain ${expectedB}.\nstdout:\n${resultB.stdout}`,
        )
      }
      if (resultB.stdout.includes(expectedC)) {
        throw new Error(
          `Project B output should NOT contain ${expectedC}.\nstdout:\n${resultB.stdout}`,
        )
      }

      return {
        stdout: resultA.stdout,
        stderr: resultA.stderr,
        details: {
          projectAExitCode: resultA.exitCode,
          projectBExitCode: resultB.exitCode,
          projectAOutput: resultA.stdout,
          projectBOutput: resultB.stdout,
          modelsFoundInProjectA: [expectedA, expectedB, expectedC].filter((m) =>
            resultA.stdout.includes(m),
          ),
          modelsFoundInProjectB: [expectedA, expectedB, expectedC].filter((m) =>
            resultB.stdout.includes(m),
          ),
          globalConfigPath,
          projectA,
          projectB,
        },
      }
    } finally {
      for (const dir of dirsToClean) {
        try {
          await fs.rm(dir, { recursive: true, force: true })
        } catch {
          // ignore cleanup errors
        }
      }
    }
  },
}

export default testCase
