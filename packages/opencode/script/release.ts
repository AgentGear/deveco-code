#!/usr/bin/env bun
/**
 * One-click release script: build CLI → publish CLI
 *
 * Usage:
 *   DEVECO_VERSION=0.0.7-beta DEVECO_CHANNEL=beta bun run script/release.ts [--single] [--skip-install]
 *
 * Environment variables (same as @opencode-ai/script):
 *   DEVECO_VERSION  - version to publish (required)
 *   DEVECO_CHANNEL  - npm tag: "beta", "latest", etc. (required)
 */
import { $ } from "bun"
import { Script } from "@opencode-ai/script"
import { fileURLToPath } from "url"
import path from "path"
import fs from "fs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cliDir = path.resolve(__dirname, "..")

console.log("=== Release ===")
console.log(`version: ${Script.version}`)
console.log(`channel: ${Script.channel}`)
console.log()

// ─── Step 1: Build CLI binary ─────────────────────────────────────────
console.log(">>> [1/2] Building CLI binary ...")
const buildArgs = process.argv.slice(2)
await $`bun run script/build.ts ${buildArgs}`
  .cwd(cliDir)
  .env({ ...process.env, DEVECO_VERSION: Script.version, DEVECO_CHANNEL: Script.channel })
console.log("✔ CLI build done")
console.log()

// ─── Step 2: Publish CLI packages ─────────────────────────────────────
console.log(">>> [2/2] Publishing CLI packages ...")
process.chdir(cliDir)

const pkg = (await Bun.file("./package.json").json()) as { name: string; license: string }
const ALLOWED_PLATFORMS = new Set(["darwin-arm64", "darwin-x64", "win32-x64"])

// Map: scoped package name → { version, dir (relative to ./dist) }
const binaries: Record<string, { version: string; dir: string }> = {}
for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })) {
  const distPkg = (await Bun.file(`./dist/${filepath}`).json()) as {
    name: string
    version: string
    os?: string[]
    cpu?: string[]
  }
  const platform = `${distPkg.os?.[0]}-${distPkg.cpu?.[0]}`
  if (!ALLOWED_PLATFORMS.has(platform)) {
    console.log(`  Skipping ${distPkg.name} (${platform})`)
    continue
  }
  if (distPkg.name.includes("-baseline")) {
    console.log(`  Skipping ${distPkg.name} (baseline)`)
    continue
  }
  binaries[distPkg.name] = { version: distPkg.version, dir: path.dirname(filepath) }
}
console.log("  binaries:", Object.fromEntries(Object.entries(binaries).map(([k, v]) => [k, v.version])))
const version = Object.values(binaries)[0]?.version

// Prepare main package
await $`mkdir -p ./dist/${pkg.name}`
await $`cp -r ./bin ./dist/${pkg.name}/bin`
await $`cp ./script/postinstall.mjs ./dist/${pkg.name}/postinstall.mjs`
await Bun.file(`./dist/${pkg.name}/LICENSE`).write(await Bun.file("../../LICENSE").text())

await Bun.file(`./dist/${pkg.name}/package.json`).write(
  JSON.stringify(
    {
      name: "@deveco/deveco",
      bin: {
        [pkg.name]: `./bin/${pkg.name}`,
      },
      scripts: {
        postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs",
      },
      version: version,
      license: pkg.license,
      optionalDependencies: Object.fromEntries(Object.entries(binaries).map(([k, v]) => [k, v.version])),
    },
    null,
    2,
  ),
)

// Publish platform packages in parallel, then main package
const tasks = Object.entries(binaries).map(async ([name, { dir }]) => {
  if (process.platform !== "win32") {
    await $`chmod -R 755 .`.cwd(`./dist/${dir}`)
  }
  await $`bun pm pack`.cwd(`./dist/${dir}`)
  await $`npm publish *.tgz --access public --tag ${Script.channel}`.cwd(`./dist/${dir}`)
  console.log(`  ✔ ${name}@${Script.version}`)
})
await Promise.all(tasks)

await $`cd ./dist/${pkg.name} && bun pm pack && npm publish *.tgz --access public --tag ${Script.channel}`
console.log(`  ✔ @deveco/deveco@${Script.version}`)

console.log()
console.log("=== Release complete ===")
console.log(`  @deveco/deveco@${Script.version}`)
console.log(`  ${Object.keys(binaries).map((n) => `${n}@${Script.version}`).join("\n  ")}`)
