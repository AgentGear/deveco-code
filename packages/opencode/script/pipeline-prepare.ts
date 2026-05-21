#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const opencodeDir = path.resolve(__dirname, "..")
const monorepoRoot = path.resolve(opencodeDir, "../..")

console.log("=== Pipeline Prepare ===")
console.log(`Monorepo root: ${monorepoRoot}`)
console.log(`Opencode dir:  ${opencodeDir}`)

// Filter workspace packages to only what's needed for CI build
// Full monorepo includes electron/tauri/desktop apps that are unnecessary for CLI build
// and cause CI timeout when electron's postinstall downloads ~200MB binary from GitHub
const neededWorkspaces = [
  "packages/opencode",
  "packages/plugin",
  "packages/script",
  "packages/sdk/js",
  "packages/core",
  "packages/app",
  "packages/ui",
  "packages/web",
  "packages/http-recorder",
  "packages/llm",
]

const rootPkgPath = path.join(monorepoRoot, "package.json")
const rootPkg = JSON.parse(await Bun.file(rootPkgPath).text())
const originalCount = rootPkg.workspaces.packages.length
rootPkg.workspaces.packages = neededWorkspaces
await Bun.write(rootPkgPath, JSON.stringify(rootPkg, null, 2))
console.log(`\n[1/4] Filtered workspaces: ${originalCount} entries → ${neededWorkspaces.length} packages`)

// Clean dist and node_modules in opencode package
console.log("\n[2/4] Cleaning dist and node_modules...")
await $`rm -rf ${path.join(opencodeDir, "dist")} ${path.join(opencodeDir, "node_modules")}`

// Install dependencies at monorepo root
console.log("\n[3/4] Installing dependencies (monorepo root)...")
await $`cd ${monorepoRoot} && bun install`

// Install dependencies in opencode package
console.log("\n[4/4] Installing dependencies (packages/opencode)...")
await $`cd ${opencodeDir} && bun install`

console.log("\n=== Pipeline Prepare Complete ===")
