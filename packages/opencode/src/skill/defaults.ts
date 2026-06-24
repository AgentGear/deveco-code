import path from "path"
import fs from "fs/promises"
import { Effect } from "effect"
import type { FSUtil } from "@opencode-ai/core/fs-util"
import { Global } from "@opencode-ai/core/global"

type EmbeddedSkillFile = string | { encoding: "base64"; content: string }

declare const DEVECO_DEFAULT_SKILLS: Record<string, Record<string, EmbeddedSkillFile>> | undefined

export namespace Defaults {
  export const ensure = Effect.fn("Skill.Defaults.ensure")(function* (version: string, fsys: FSUtil.Interface) {
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

    yield* Effect.logInfo("extracting default skills", { version })

    // Backup user-installed skills before cleaning built-in skills
    const userSkillBackupDir = path.join(Global.Path.config, "skills")
    yield* Effect.tryPromise(() =>
      fs.readdir(dir, { withFileTypes: true }),
    ).pipe(
      Effect.flatMap((entries) =>
        Effect.forEach(
          entries.filter((e) => e.isDirectory()),
          (entry) =>
            Effect.gen(function* () {
              const subVersionFile = path.join(dir, entry.name, ".version")
              const isBuiltin = yield* fsys.existsSafe(subVersionFile)
              if (isBuiltin) return // skip built-in skills
              // Copy user-installed skill to config directory
              const src = path.join(dir, entry.name)
              const dest = path.join(userSkillBackupDir, entry.name)
              yield* Effect.tryPromise(() =>
                fs.cp(src, dest, { recursive: true }),
              ).pipe(Effect.catch(() => Effect.void))
            }),
          { concurrency: "unbounded" },
        ),
      ),
      Effect.catch(() => Effect.void),
    )

    // Clean up built-in skill subdirectories only, preserving user skills
    const data = typeof DEVECO_DEFAULT_SKILLS !== "undefined" ? DEVECO_DEFAULT_SKILLS : {}

    yield* Effect.tryPromise(() =>
      fs.readdir(dir, { withFileTypes: true }),
    ).pipe(
      Effect.flatMap((entries) =>
        Effect.forEach(
          entries.filter((e) => e.isDirectory()),
          (entry) =>
            Effect.gen(function* () {
              const subVersionFile = path.join(dir, entry.name, ".version")
              const isBuiltin = yield* fsys.existsSafe(subVersionFile)
              if (!isBuiltin) return
              yield* Effect.tryPromise(() =>
                fs.rm(path.join(dir, entry.name), { recursive: true, force: true }),
              ).pipe(Effect.catch(() => Effect.void))
            }),
          { concurrency: "unbounded" },
        ),
      ),
      Effect.catch(() => Effect.void),
    )

    // Extract from embedded data

    for (const [skillName, files] of Object.entries(data)) {
      yield* fsys.writeWithDirs(path.join(dir, skillName, ".version"), skillName)
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
