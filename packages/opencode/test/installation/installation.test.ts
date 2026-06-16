import { describe, expect, test } from "bun:test"
import { Effect, Layer, Stream } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"
import {
  Event,
  Installation,
  UpgradeFailedError,
  USER_AGENT,
  getReleaseType,
  type ReleaseType,
  isLocal,
  isPreview,
  userAgent,
} from "../../src/installation"
import { InstallationChannel, InstallationVersion } from "@opencode-ai/core/installation/version"
import { AppProcess } from "@opencode-ai/core/process"
import { testEffect } from "../lib/effect"

const encoder = new TextEncoder()
const sink = { [Symbol.for("effect/Sink/TypeId")]: Symbol.for("effect/Sink/TypeId") } as any

function mockHttpClient(handler: (request: HttpClientRequest.HttpClientRequest) => Response) {
  const client = HttpClient.make((request) => Effect.succeed(HttpClientResponse.fromWeb(request, handler(request))))
  return Layer.succeed(HttpClient.HttpClient, client)
}

function mockSpawner(
  handler: (cmd: string, args: readonly string[]) => string | { code: number; stdout?: string; stderr?: string } = () =>
    "",
) {
  const spawner = ChildProcessSpawner.make((command) => {
    const std = ChildProcess.isStandardCommand(command) ? command : undefined
    const result = handler(std?.command ?? "", std?.args ?? [])
    const output = typeof result === "string" ? { code: 0, stdout: result, stderr: "" } : result
    return Effect.succeed(
      ChildProcessSpawner.makeHandle({
        pid: ChildProcessSpawner.ProcessId(0),
        exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(output.code)),
        isRunning: Effect.succeed(false),
        kill: () => Effect.void,
        stdin: { [Symbol.for("effect/Sink/TypeId")]: Symbol.for("effect/Sink/TypeId") } as any,
        stdout: output.stdout ? Stream.make(encoder.encode(output.stdout)) : Stream.empty,
        stderr: output.stderr ? Stream.make(encoder.encode(output.stderr)) : Stream.empty,
        all: Stream.empty,
        getInputFd: () => sink,
        getOutputFd: () => Stream.empty,
        unref: Effect.succeed(Effect.void),
      }),
    )
  })
  return Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner)
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

function testLayer(
  httpHandler: (request: HttpClientRequest.HttpClientRequest) => Response,
  spawnHandler?: (cmd: string, args: readonly string[]) => string | { code: number; stdout?: string; stderr?: string },
) {
  const appProcess = AppProcess.layer.pipe(Layer.provide(mockSpawner(spawnHandler)))
  return Installation.layer.pipe(Layer.provide(mockHttpClient(httpHandler)), Layer.provide(appProcess))
}

describe("installation", () => {
  describe("getReleaseType", () => {
    test.each([
      ["1.0.0", "2.0.0", "major"],
      ["1.0.0", "1.1.0", "minor"],
      ["1.0.0", "1.0.5", "patch"],
      ["1.0.0", "1.0.0", "patch"],
      ["2.0.0", "1.0.0", "patch"],
      ["1.5.0", "1.3.0", "patch"],
    ])("getReleaseType(%s -> %s) is %s", (current, latest, expected) => {
      expect(getReleaseType(current, latest)).toBe(expected as ReleaseType)
    })
  })

  describe("userAgent", () => {
    test("formats the channel, version and client", () => {
      expect(userAgent()).toBe(`opencode/${InstallationChannel}/${InstallationVersion}/cli`)
      expect(userAgent("tui")).toBe(`opencode/${InstallationChannel}/${InstallationVersion}/tui`)
    })

    test("USER_AGENT is the default (cli) user agent", () => {
      expect(USER_AGENT).toBe(userAgent())
    })
  })

  describe("channel helpers", () => {
    test("isPreview is true unless running on the latest channel", () => {
      expect(isPreview()).toBe(InstallationChannel !== "latest")
    })

    test("isLocal is true only on the local channel", () => {
      expect(isLocal()).toBe(InstallationChannel === "local")
    })
  })

  test("UpgradeFailedError carries stderr and is tagged", () => {
    const err = new UpgradeFailedError({ stderr: "boom" })
    expect(err.stderr).toBe("boom")
    expect(err._tag).toBe("UpgradeFailedError")
  })

  test("Event defines the updated and update-available events", () => {
    expect(Event.Updated.type).toBe("installation.updated")
    expect(Event.UpdateAvailable.type).toBe("installation.update-available")
  })

  describe("Service.latest", () => {
    let latestUrl = ""
    testEffect(testLayer((request) => {
      latestUrl = request.url
      return jsonResponse({ version: "1.2.3" })
    })).effect("reads the latest version from the deveco npm registry", () =>
      Effect.gen(function* () {
        const result = yield* Installation.use.latest("npm")
        expect(result).toBe("1.2.3")
        expect(latestUrl).toContain("@deveco%2fdeveco-code")
        expect(latestUrl).toContain(`/${InstallationChannel}`)
      }),
    )
  })

  describe("Service.method", () => {
    testEffect(testLayer(() => jsonResponse({}), (cmd) => (cmd === "npm" ? "@deveco/deveco-code" : ""))).effect(
      "detects npm when the global npm list contains the deveco package",
      () =>
        Effect.gen(function* () {
          expect(yield* Installation.use.method()).toBe("npm")
        }),
    )

    testEffect(testLayer(() => jsonResponse({}), (cmd) => (cmd === "bun" ? "@deveco/deveco-code" : ""))).effect(
      "detects bun when the global bun list contains the deveco package",
      () =>
        Effect.gen(function* () {
          expect(yield* Installation.use.method()).toBe("bun")
        }),
    )

    testEffect(testLayer(() => jsonResponse({}), () => "")).effect("falls back to unknown when no manager reports the package", () =>
      Effect.gen(function* () {
        expect(yield* Installation.use.method()).toBe("unknown")
      }),
    )
  })

  describe("Service.upgrade", () => {
    const npmCalls: Array<{ cmd: string; args: readonly string[] }> = []
    testEffect(
      testLayer(() => jsonResponse({}), (cmd, args) => {
        npmCalls.push({ cmd, args })
        return ""
      }),
    ).effect("runs `npm install -g @deveco/deveco-code@<target>` to upgrade", () =>
      Effect.gen(function* () {
        yield* Installation.use.upgrade("npm", "1.2.3")
        expect(npmCalls.some((c) => c.cmd === "npm" && c.args.includes("install") && c.args.includes("@deveco/deveco-code@1.2.3"))).toBe(true)
      }),
    )

    const bunCalls: Array<{ cmd: string; args: readonly string[] }> = []
    testEffect(
      testLayer(() => jsonResponse({}), (cmd, args) => {
        bunCalls.push({ cmd, args })
        return ""
      }),
    ).effect("uses the bun package manager for the bun method", () =>
      Effect.gen(function* () {
        yield* Installation.use.upgrade("bun", "0.9.0")
        expect(bunCalls.some((c) => c.cmd === "bun" && c.args.includes("@deveco/deveco-code@0.9.0"))).toBe(true)
      }),
    )

    testEffect(testLayer(() => jsonResponse({}), (cmd) => (cmd === "npm" ? { code: 1, stderr: "EACCES" } : ""))).effect(
      "fails with UpgradeFailedError when the installer exits non-zero",
      () =>
        Effect.gen(function* () {
          const result = yield* Installation.use.upgrade("npm", "1.2.3").pipe(Effect.flip)
          expect(result).toBeInstanceOf(UpgradeFailedError)
          expect(result.stderr).toBe("EACCES")
        }),
    )

    testEffect(testLayer(() => jsonResponse({}), () => "")).effect("fails with UpgradeFailedError for an unknown method", () =>
      Effect.gen(function* () {
        const result = yield* Installation.use.upgrade("unknown", "1.2.3").pipe(Effect.flip)
        expect(result).toBeInstanceOf(UpgradeFailedError)
        expect(result.stderr).toContain("Unknown method")
      }),
    )
  })

  describe("upgrade", () => {
    testEffect(
      testLayer(
        () => jsonResponse({}),
        (cmd) => {
          if (cmd === "npm") return { code: 1, stderr: "token=secret command output" }
          return ""
        },
      ),
    ).effect("returns sanitized typed errors for failed package upgrades", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(Installation.use.upgrade("npm", "9.9.9"))
        expect(error).toBeInstanceOf(Installation.UpgradeFailedError)
        expect(error.stderr).toBe("Upgrade failed for npm (exit code 1).")
        expect(error.message).toBe(error.stderr)
        expect(error.stderr).not.toContain("secret")
        expect(error.stderr).not.toContain("command output")
      }),
    )

    testEffect(
      testLayer(
        () => new Response("install script with token=secret", { status: 200 }),
        (cmd) => {
          if (cmd === "bash") return { code: 1, stderr: "script output with token=secret" }
          return ""
        },
      ),
    ).effect("returns sanitized typed errors when the curl install script fails", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(Installation.use.upgrade("curl", "9.9.9"))
        expect(error).toBeInstanceOf(Installation.UpgradeFailedError)
        expect(error.stderr).toBe("Upgrade failed for curl (exit code 1).")
        expect(error.message).toBe(error.stderr)
        expect(error.stderr).not.toContain("secret")
        expect(error.stderr).not.toContain("script output")
      }),
    )
  })
})
