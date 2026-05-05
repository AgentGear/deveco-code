import path from "path"
import { Effect } from "effect"
import type { AppFileSystem } from "@opencode-ai/core/filesystem"
import { Global } from "@opencode-ai/core/global"
import * as Log from "@opencode-ai/core/util/log"

type EmbeddedSkillFile = string | { encoding: "base64"; content: string }

declare const CODEGENIE_DEFAULT_SKILLS: Record<string, Record<string, EmbeddedSkillFile>> | undefined

export namespace Defaults {
  const log = Log.create({ service: "skill-defaults" })

  export const ensure = Effect.fn("Skill.Defaults.ensure")(function* (version: string, fsys: AppFileSystem.Interface) {
    const dir = path.join(Global.Path.data, "skills")
    const versionFile = path.join(dir, ".version")

    // Version match check - skip if already extracted for this version
    const current = yield* Effect.gen(function* () {
      const exists = yield* fsys.existsSafe(versionFile)
      if (!exists) return ""
      const buf = yield* fsys.readFile(versionFile)
      return new TextDecoder().decode(buf)
    }).pipe(Effect.catch(() => Effect.succeed("")))
    if (current === version && current !== "local") {
      return dir
    }

    log.info("extracting default skills", { version })

    // Clean up old files
    yield* Effect.tryPromise(() =>
      import("fs/promises").then((fs) => fs.rm(dir, { recursive: true, force: true })),
    ).pipe(Effect.catch(() => Effect.void))

    // Extract from embedded data
    const data = typeof CODEGENIE_DEFAULT_SKILLS !== "undefined" ? CODEGENIE_DEFAULT_SKILLS : {}
    for (const [skillName, files] of Object.entries(data)) {
      for (const [fileName, content] of Object.entries(files)) {
        yield* fsys.writeWithDirs(
          path.join(dir, skillName, fileName),
          typeof content === "string" ? content : Uint8Array.from(Buffer.from(content.content, content.encoding)),
        )
      }
    }

    // Write version marker
    yield* fsys.writeWithDirs(versionFile, version)

    return dir
  })
}
