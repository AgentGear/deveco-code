import { $ } from "bun"
import semver from "semver"
import path from "path"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const env = {
  CODEGENIE_CHANNEL: process.env["CODEGENIE_CHANNEL"],
  CODEGENIE_BUMP: process.env["CODEGENIE_BUMP"],
  CODEGENIE_VERSION: process.env["CODEGENIE_VERSION"],
  CODEGENIE_RELEASE: process.env["CODEGENIE_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.CODEGENIE_CHANNEL) return env.CODEGENIE_CHANNEL
  if (env.CODEGENIE_BUMP) return "latest"
  if (env.CODEGENIE_VERSION && !env.CODEGENIE_VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim())
})()
const IS_PREVIEW = CHANNEL !== "latest"

const VERSION = await (async () => {
  if (env.CODEGENIE_VERSION) return env.CODEGENIE_VERSION
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  const version = await fetch("https://registry.npmjs.org/opencode-ai/latest")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data: any) => data.version)
  const [major, minor, patch] = version.split(".").map((x: string) => Number(x) || 0)
  const t = env.CODEGENIE_BUMP?.toLowerCase()
  if (t === "major") return `${major + 1}.0.0`
  if (t === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

const bot = ["actions-user", "codegenie", "codegenie-agent[bot]"]
const teamPath = path.resolve(import.meta.dir, "../../../.github/TEAM_MEMBERS")
const team = [
  ...(await Bun.file(teamPath)
    .text()
    .then((x) => x.split(/\r?\n/).map((x) => x.trim()))
    .then((x) => x.filter((x) => x && !x.startsWith("#")))),
  ...bot,
]

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.CODEGENIE_RELEASE
  },
  get team() {
    return team
  },
}
console.log(`codegenie script`, JSON.stringify(Script, null, 2))
