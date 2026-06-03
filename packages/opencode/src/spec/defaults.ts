import path from "path"
import fs from "fs/promises"
import { Effect } from "effect"
import type { AppFileSystem } from "@opencode-ai/core/filesystem"
import { Global } from "@opencode-ai/core/global"
import * as Log from "@opencode-ai/core/util/log"

interface EmbeddedSpecFileMap {
  [key: string]: EmbeddedSpecFile
}
type EmbeddedSpecFile = string | { encoding: "base64"; content: string } | EmbeddedSpecFileMap

declare const DEVECO_DEFAULT_SPEC_RESOURCES: Record<string, EmbeddedSpecFile> | undefined

const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bin"])

async function walkDir(directory: string): Promise<string[]> {
  const result: string[] = []
  async function recurse(dir: string) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await recurse(full)
      else if (entry.name !== ".DS_Store") result.push(full)
    }
  }
  await recurse(directory)
  return result
}

async function loadSpecResourcesFromDisk(): Promise<Record<string, EmbeddedSpecFile>> {
  const resourceDir = path.join(import.meta.dirname, "../../resources/spec")
  try {
    await fs.access(resourceDir)
  } catch {
    return {}
  }
  const data: Record<string, EmbeddedSpecFile> = {}
  for (const entry of await fs.readdir(resourceDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const files: Record<string, EmbeddedSpecFile> = {}
      const specPath = path.join(resourceDir, entry.name)
      for (const file of await walkDir(specPath)) {
        const rel = path.relative(specPath, file).replaceAll("\\", "/")
        if (binaryExtensions.has(path.extname(file).toLowerCase())) {
          const buf = await fs.readFile(file)
          files[rel] = { encoding: "base64", content: buf.toString("base64") }
        } else {
          files[rel] = await fs.readFile(file, "utf-8")
        }
      }
      data[entry.name] = files
    } else if (entry.isFile()) {
      data[entry.name] = await fs.readFile(path.join(resourceDir, entry.name), "utf-8")
    }
  }
  return data
}

export namespace Defaults {
  const log = Log.create({ service: "spec-defaults" })

  export const ensure = Effect.fn("Spec.Defaults.ensure")(function* (version: string, fsys: AppFileSystem.Interface) {
    const specDir = path.join(Global.Path.data, "specs")
    const versionFile = path.join(specDir, ".version")

    const current = yield* Effect.gen(function* () {
      const exists = yield* fsys.existsSafe(versionFile)
      if (!exists) return ""
      const buf = yield* fsys.readFile(versionFile)
      return new TextDecoder().decode(buf)
    }).pipe(Effect.catch(() => Effect.succeed("")))
    if (current === version && current !== "local") {
      return { specDir }
    }

    log.info("extracting default spec resources", { version })

    yield* Effect.tryPromise(() =>
      import("fs/promises").then((fs) => fs.rm(path.join(specDir, "commands"), { recursive: true, force: true })),
    ).pipe(Effect.catch(() => Effect.void))
    yield* Effect.tryPromise(() =>
      import("fs/promises").then((fs) => fs.rm(path.join(specDir, "templates"), { recursive: true, force: true })),
    ).pipe(Effect.catch(() => Effect.void))

    const data =
      typeof DEVECO_DEFAULT_SPEC_RESOURCES !== "undefined"
        ? DEVECO_DEFAULT_SPEC_RESOURCES
        : yield* Effect.promise(loadSpecResourcesFromDisk)
    for (const [name, content] of Object.entries(data)) {
      if (typeof content === "string") {
        continue
      } else if (typeof content === "object" && !("encoding" in content)) {
        const targetDir = path.join(specDir, name)
        for (const [fileName, fileContent] of Object.entries(content as Record<string, EmbeddedSpecFile>)) {
          if (typeof fileContent === "string") {
            yield* fsys.writeWithDirs(path.join(targetDir, fileName), fileContent)
          } else if (typeof fileContent === "object" && "encoding" in fileContent) {
            const encoded = fileContent as { encoding: "base64"; content: string }
            const decoded = Buffer.from(encoded.content, "base64")
            yield* fsys.writeWithDirs(path.join(targetDir, fileName), Uint8Array.from(decoded))
          }
        }
      }
    }

    yield* fsys.writeWithDirs(versionFile, version)

    return { specDir }
  })
}
