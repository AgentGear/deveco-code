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

// Clean dist and node_modules in opencode package
console.log("\n[1/3] Cleaning dist and node_modules...")
await $`rm -rf ${path.join(opencodeDir, "dist")} ${path.join(opencodeDir, "node_modules")}`

// Install dependencies at monorepo root
console.log("\n[2/3] Installing dependencies (monorepo root)...")
await $`cd ${monorepoRoot} && bun install`

// Install dependencies in opencode package
console.log("\n[3/3] Installing dependencies (packages/opencode)...")
await $`cd ${opencodeDir} && bun install`

console.log("\n=== Pipeline Prepare Complete ===")
