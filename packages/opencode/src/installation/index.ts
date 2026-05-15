import { Effect, Layer, Schema, Context, Stream } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { withTransientReadRetry } from "@/util/effect-http-client"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"
import z from "zod"
import { BusEvent } from "@/bus/bus-event"
import { Flag } from "@opencode-ai/core/flag/flag"
import * as Log from "@opencode-ai/core/util/log"
import { makeRuntime } from "@opencode-ai/core/effect/runtime"
import semver from "semver"
import { InstallationChannel, InstallationVersion } from "@opencode-ai/core/installation/version"

const log = Log.create({ service: "installation" })

export type Method = "npm" | "pnpm" | "bun" | "unknown"

export type ReleaseType = "patch" | "minor" | "major"

export const Event = {
  Updated: BusEvent.define(
    "installation.updated",
    Schema.Struct({
      version: Schema.String,
    }),
  ),
  UpdateAvailable: BusEvent.define(
    "installation.update-available",
    Schema.Struct({
      version: Schema.String,
    }),
  ),
}

export function getReleaseType(current: string, latest: string): ReleaseType {
  const currMajor = semver.major(current)
  const currMinor = semver.minor(current)
  const newMajor = semver.major(latest)
  const newMinor = semver.minor(latest)

  if (newMajor > currMajor) return "major"
  if (newMinor > currMinor) return "minor"
  return "patch"
}

export const Info = z
  .object({
    version: z.string(),
    latest: z.string(),
  })
  .meta({
    ref: "InstallationInfo",
  })
export type Info = z.infer<typeof Info>

export const USER_AGENT = `deveco/${InstallationChannel}/${InstallationVersion}/${Flag.DEVECO_CLIENT}`

export function isPreview() {
  return InstallationChannel !== "latest"
}

export function isLocal() {
  return InstallationChannel === "local"
}

export class UpgradeFailedError extends Schema.TaggedErrorClass<UpgradeFailedError>()("UpgradeFailedError", {
  stderr: Schema.String,
}) {}

// Response schemas for external version APIs
const NpmPackage = Schema.Struct({ version: Schema.String })

export interface Interface {
  readonly info: () => Effect.Effect<Info>
  readonly method: () => Effect.Effect<Method>
  readonly latest: (method?: Method) => Effect.Effect<string>
  readonly validateVersion: (method: Method, target: string) => Effect.Effect<boolean>
  readonly upgrade: (method: Method, target: string) => Effect.Effect<void, UpgradeFailedError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Installation") {}

export const layer: Layer.Layer<Service, never, HttpClient.HttpClient | ChildProcessSpawner.ChildProcessSpawner> =
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const httpOk = HttpClient.filterStatusOk(withTransientReadRetry(http))
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner

      const text = Effect.fnUntraced(
        function* (cmd: string[], opts?: { cwd?: string; env?: Record<string, string> }) {
          const proc = ChildProcess.make(cmd[0], cmd.slice(1), {
            cwd: opts?.cwd,
            env: opts?.env,
            extendEnv: true,
          })
          const handle = yield* spawner.spawn(proc)
          const out = yield* Stream.mkString(Stream.decodeText(handle.stdout))
          yield* handle.exitCode
          return out
        },
        Effect.scoped,
        Effect.catch(() => Effect.succeed("")),
      )

      const run = Effect.fnUntraced(
        function* (cmd: string[], opts?: { cwd?: string; env?: Record<string, string> }) {
          const proc = ChildProcess.make(cmd[0], cmd.slice(1), {
            cwd: opts?.cwd,
            env: opts?.env,
            extendEnv: true,
          })
          const handle = yield* spawner.spawn(proc)
          const [stdout, stderr] = yield* Effect.all(
            [Stream.mkString(Stream.decodeText(handle.stdout)), Stream.mkString(Stream.decodeText(handle.stderr))],
            { concurrency: 2 },
          )
          const code = yield* handle.exitCode
          return { code, stdout, stderr }
        },
        Effect.scoped,
        Effect.catch(() => Effect.succeed({ code: ChildProcessSpawner.ExitCode(1), stdout: "", stderr: "" })),
      )

      // Use the package manager's resolver so registries, mirrors, auth, proxies, and dist-tags match upgrade behavior.
      const viewVersion = Effect.fnUntraced(function* (method: "npm" | "pnpm" | "bun", spec: string) {
        const args = method === "bun" ? ["pm", "view", spec, "version", "--json"] : ["view", spec, "version", "--json"]
        const result = yield* run([method, ...args])
        if (result.code !== 0 || !result.stdout.trim()) {
          return yield* new UpgradeFailedError({
            stderr: result.stderr || result.stdout || `Failed to resolve ${spec}`,
          })
        }
        return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.String))(result.stdout)
      })

      const result: Interface = {
        info: Effect.fn("Installation.info")(function* () {
          return {
            version: InstallationVersion,
            latest: yield* result.latest(),
          }
        }),
        method: Effect.fn("Installation.method")(function* () {
          const exec = process.execPath.toLowerCase()

          const checks: Array<{ name: Method; command: () => Effect.Effect<string> }> = [
            { name: "npm", command: () => text(["npm", "list", "-g", "--depth=0"]) },
            { name: "pnpm", command: () => text(["pnpm", "list", "-g", "--depth=0"]) },
            { name: "bun", command: () => text(["bun", "pm", "ls", "-g"]) },
          ]

          checks.sort((a, b) => {
            const aMatches = exec.includes(a.name)
            const bMatches = exec.includes(b.name)
            if (aMatches && !bMatches) return -1
            if (!aMatches && bMatches) return 1
            return 0
          })

          for (const check of checks) {
            const output = yield* check.command()
            if (output.includes("@deveco/deveco")) {
              return check.name
            }
          }

          return "unknown" as Method
        }),
        latest: Effect.fn("Installation.latest")(function* (installMethod?: Method) {
          const detectedMethod = installMethod || (yield* result.method())

          if (detectedMethod === "npm" || detectedMethod === "bun" || detectedMethod === "pnpm") {
            return yield* viewVersion(detectedMethod, `@deveco/deveco@${InstallationChannel}`)
          }

          const r = (yield* text(["npm", "config", "get", "registry"])).trim()
          const reg = r || "https://registry.npmjs.org"
          const registry = reg.endsWith("/") ? reg.slice(0, -1) : reg
          const channel = InstallationChannel
          const response = yield* httpOk.execute(
            HttpClientRequest.get(`${registry}/@deveco%2Fdeveco/${channel}`).pipe(
              HttpClientRequest.acceptJson,
            ),
          )
          const data = yield* HttpClientResponse.schemaBodyJson(NpmPackage)(response)
          return data.version
        }, Effect.orDie),
        validateVersion: Effect.fn("Installation.validateVersion")(function* (m: Method, target: string) {
          const effectiveMethod = (m === "unknown" ? "npm" : m) as "npm" | "pnpm" | "bun"
          const args =
            effectiveMethod === "bun"
              ? ["pm", "view", `@deveco/deveco@${target}`, "version", "--json"]
              : ["view", `@deveco/deveco@${target}`, "version", "--json"]
          const result = yield* run([effectiveMethod, ...args])
          return result.code === 0 && !!result.stdout.trim()
        }),
        upgrade: Effect.fn("Installation.upgrade")(function* (m: Method, target: string) {
          let upgradeResult: { code: ChildProcessSpawner.ExitCode; stdout: string; stderr: string } | undefined
          switch (m) {
            case "npm":
              upgradeResult = yield* run(["npm", "install", "-g", `@deveco/deveco@${target}`])
              break
            case "pnpm":
              upgradeResult = yield* run(["pnpm", "install", "-g", `@deveco/deveco@${target}`])
              break
            case "bun":
              upgradeResult = yield* run(["bun", "install", "-g", `@deveco/deveco@${target}`])
              break
            default:
              upgradeResult = yield* run(["npm", "install", "-g", `@deveco/deveco@${target}`])
              break
          }
          if (!upgradeResult || upgradeResult.code !== 0) {
            return yield* new UpgradeFailedError({ stderr: upgradeResult?.stderr || "" })
          }
          log.info("upgraded", {
            method: m,
            target,
            stdout: upgradeResult.stdout,
            stderr: upgradeResult.stderr,
          })
          yield* text([process.execPath, "--version"])
        }),
      }

      return Service.of(result)
    }),
  )

export const defaultLayer = layer.pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(CrossSpawnSpawner.defaultLayer),
)

const { runPromise } = makeRuntime(Service, defaultLayer)

export const latest = (...args: Parameters<Interface["latest"]>) => runPromise((s) => s.latest(...args))
export const method = () => runPromise((s) => s.method())
export const validateVersion = (...args: Parameters<Interface["validateVersion"]>) =>
  runPromise((s) => s.validateVersion(...args))
export const upgrade = (...args: Parameters<Interface["upgrade"]>) => runPromise((s) => s.upgrade(...args))

export * as Installation from "."
