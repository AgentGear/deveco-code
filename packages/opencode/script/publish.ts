#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@opencode-ai/script"
import { fileURLToPath } from "url"
import path from "path"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

async function published(name: string, version: string) {
  return (await $`npm view ${name}@${version} version`.nothrow()).exitCode === 0
}

async function publish(cwd: string, name: string, version: string) {
  if (process.platform !== "win32") await $`chmod -R 755 .`.cwd(cwd)
  if (await published(name, version)) {
    console.log(`already published ${name}@${version}`)
    return
  }
  await $`bun pm pack`.cwd(cwd)
  await $`npm publish *.tgz --access public --tag ${Script.channel}`.cwd(cwd)
}

const ALLOWED_PLATFORMS = new Set(["darwin-arm64", "darwin-x64", "win32-x64"])

// Map: package name → { version, directory }
const binaries: Record<string, { version: string; dir: string }> = {}
for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })) {
  const distPkg = await Bun.file(`./dist/${filepath}`).json()
  const platform = `${distPkg.os?.[0]}-${distPkg.cpu?.[0]}`
  if (!ALLOWED_PLATFORMS.has(platform)) {
    console.log(`Skipping ${distPkg.name} (${platform})`)
    continue
  }
  if (distPkg.name.includes("-baseline")) {
    console.log(`Skipping ${distPkg.name} (baseline)`)
    continue
  }
  binaries[distPkg.name] = { version: distPkg.version, dir: path.dirname(filepath) }
}
console.log("binaries", Object.fromEntries(Object.entries(binaries).map(([k, v]) => [k, v.version])))
const version = Object.values(binaries)[0]?.version

await $`mkdir -p ./dist/${pkg.name}`
await $`cp -r ./bin ./dist/${pkg.name}/bin`
await $`cp ./script/postinstall.mjs ./dist/${pkg.name}/postinstall.mjs`
await Bun.file(`./dist/${pkg.name}/LICENSE`).write(await Bun.file("../../LICENSE").text())

await Bun.file(`./dist/${pkg.name}/package.json`).write(
  JSON.stringify(
    {
      name: "@codegenie-ai/codegenie-cli",
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

const tasks = Object.entries(binaries).map(async ([name, { version, dir }]) => {
  await publish(`./dist/${dir}`, name, version)
})
await Promise.all(tasks)
await publish(`./dist/${pkg.name}`, "@codegenie-ai/codegenie-cli", version)
