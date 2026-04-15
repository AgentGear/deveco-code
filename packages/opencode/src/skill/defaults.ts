import path from "path"
import fs from "fs/promises"
import { Global } from "@/global"
import { Installation } from "@/installation"
import { Filesystem } from "@/util/filesystem"
import { Log } from "@/util/log"

declare const CODEGENIE_DEFAULT_SKILLS: Record<string, Record<string, string>> | undefined

export namespace Defaults {
  const log = Log.create({ service: "skill-defaults" })

  export async function ensure(): Promise<string> {
    const dir = path.join(Global.Path.data, "skills")
    const versionFile = path.join(dir, ".version")

    // Version match check - skip if already extracted for this version
    const current = await Filesystem.readText(versionFile).catch(() => "")
    if (current === Installation.VERSION && current !== "local") {
      return dir
    }

    log.info("extracting default skills", { version: Installation.VERSION })

    // Clean up old files
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})

    // Extract from embedded data
    const data = typeof CODEGENIE_DEFAULT_SKILLS !== "undefined" ? CODEGENIE_DEFAULT_SKILLS : {}
    for (const [skillName, files] of Object.entries(data)) {
      for (const [fileName, content] of Object.entries(files)) {
        await Filesystem.write(path.join(dir, skillName, fileName), content)
      }
    }

    // Write version marker
    await Filesystem.write(versionFile, Installation.VERSION)

    return dir
  }
}
