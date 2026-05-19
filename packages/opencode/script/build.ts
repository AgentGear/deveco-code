#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

await import("./generate.ts")

import { Script } from "@opencode-ai/script"
import pkg from "../package.json"

// Load migrations from migration directories
const migrationDirs = (
  await fs.promises.readdir(path.join(dir, "migration"), {
    withFileTypes: true,
  })
)
  .filter((entry) => entry.isDirectory() && /^\d{4}\d{2}\d{2}\d{2}\d{2}\d{2}/.test(entry.name))
  .map((entry) => entry.name)
  .sort()

const migrations = await Promise.all(
  migrationDirs.map(async (name) => {
    const file = path.join(dir, "migration", name, "migration.sql")
    const sql = await Bun.file(file).text()
    const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(name)
    const timestamp = match
      ? Date.UTC(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6]),
        )
      : 0
    return { sql, timestamp, name }
  }),
)
console.log(`Loaded ${migrations.length} migrations`)

// Load default skills from resources/skills/
async function walk(directory: string): Promise<string[]> {
  const result: string[] = []
  async function recurse(dir: string) {
    for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isSymbolicLink()) {
        continue
      }
      if (entry.isDirectory()) {
        await recurse(full)
      } else if (entry.name !== ".DS_Store") {
        result.push(full)
      }
    }
  }
  await recurse(directory)
  return result
}

const defaultSkillsDir = path.join(dir, "resources/skills")
type EmbeddedFile = string | { encoding: "base64"; content: string }

const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bin"])
const defaultSkillsData: Record<string, Record<string, EmbeddedFile>> = {}
if (fs.existsSync(defaultSkillsDir)) {
  for (const entry of await fs.promises.readdir(defaultSkillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const files: Record<string, EmbeddedFile> = {}
    const skillPath = path.join(defaultSkillsDir, entry.name)
    for (const file of await walk(skillPath)) {
      const rel = path.relative(skillPath, file).replaceAll("\\", "/")
      files[rel] = binaryExtensions.has(path.extname(file).toLowerCase())
        ? { encoding: "base64", content: Buffer.from(await Bun.file(file).arrayBuffer()).toString("base64") }
        : await Bun.file(file).text()
    }
    defaultSkillsData[entry.name] = files
  }
}
console.log(`Loaded ${Object.keys(defaultSkillsData).length} default skills`)

const defaultSpecDir = path.join(dir, "resources/spec")
const defaultSpecData: Record<string, Record<string, EmbeddedFile> | EmbeddedFile> = {}
if (fs.existsSync(defaultSpecDir)) {
  for (const entry of await fs.promises.readdir(defaultSpecDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const files: Record<string, EmbeddedFile> = {}
      const specPath = path.join(defaultSpecDir, entry.name)
      for (const file of await walk(specPath)) {
        const rel = path.relative(specPath, file).replaceAll("\\", "/")
        files[rel] = binaryExtensions.has(path.extname(file).toLowerCase())
          ? { encoding: "base64", content: Buffer.from(await Bun.file(file).arrayBuffer()).toString("base64") }
          : await Bun.file(file).text()
      }
      defaultSpecData[entry.name] = files
    } else if (entry.isFile()) {
      defaultSpecData[entry.name] = await Bun.file(path.join(defaultSpecDir, entry.name)).text()
    }
  }
}
console.log(`Loaded ${Object.keys(defaultSpecData).length} default spec resources`)

const singleFlag = process.argv.includes("--single")
const baselineFlag = process.argv.includes("--baseline")
const skipInstall = process.argv.includes("--skip-install")
const sourcemapsFlag = process.argv.includes("--sourcemaps")
const plugin = createSolidTransformPlugin()
const skipEmbedWebUi = process.argv.includes("--skip-embed-web-ui")

const createEmbeddedWebUIBundle = async () => {
  console.log(`Building Web UI to embed in the binary`)
  const appDir = path.join(import.meta.dirname, "../../app")
  const dist = path.join(appDir, "dist")
  await $`bun run --cwd ${appDir} build`
  const files = (await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: dist })))
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => !file.endsWith(".map"))
    .sort()
  const imports = files.map((file, i) => {
    const spec = path.relative(dir, path.join(dist, file)).replaceAll("\\", "/")
    return `import file_${i} from ${JSON.stringify(spec.startsWith(".") ? spec : `./${spec}`)} with { type: "file" };`
  })
  const entries = files.map((file, i) => `  ${JSON.stringify(file)}: file_${i},`)
  return [
    `// Import all files as file_$i with type: "file"`,
    ...imports,
    `// Export with original mappings`,
    `export default {`,
    ...entries,
    `}`,
  ].join("\n")
}

const embeddedFileMap = skipEmbedWebUi ? null : await createEmbeddedWebUIBundle()

const allTargets: {
  os: string
  arch: "arm64" | "x64"
  abi?: "musl"
  avx2?: false
}[] = [
  {
    os: "darwin",
    arch: "arm64",
  },
  {
    os: "darwin",
    arch: "x64",
  },
  {
    os: "win32",
    arch: "x64",
  },
]

const targets = singleFlag
  ? allTargets.filter((item) => {
      if (item.os !== process.platform || item.arch !== process.arch) {
        return false
      }

      // When building for the current platform, prefer a single native binary by default.
      // Baseline binaries require additional Bun artifacts and can be flaky to download.
      if (item.avx2 === false) {
        return baselineFlag
      }

      // also skip abi-specific builds for the same reason
      if (item.abi !== undefined) {
        return false
      }

      return true
    })
  : allTargets

await $`rm -rf dist`

// Vendored binaries cache (downloaded by postinstall.ts during bun install)
const cacheDir = path.join(dir, ".build-cache")
const rgCacheDir = path.join(cacheDir, "ripgrep")
const mcpCacheDir = path.join(cacheDir, "mcp-bridge")

const RG_VERSION = "15.1.0"
const rgArchiveMap: Record<string, { archive: string; binary: string }> = {
  "darwin-arm64": { archive: `ripgrep-${RG_VERSION}-aarch64-apple-darwin.tar.gz`, binary: "rg" },
  "darwin-x64":   { archive: `ripgrep-${RG_VERSION}-x86_64-apple-darwin.tar.gz`, binary: "rg" },
  "win32-x64":    { archive: `ripgrep-${RG_VERSION}-x86_64-pc-windows-msvc.zip`, binary: "rg.exe" },
}

const binaries: Record<string, string> = {}
if (!skipInstall) {
  await $`bun install --os="*" --cpu="*" @opentui/core@${pkg.dependencies["@opentui/core"]}`
  await $`bun install --os="*" --cpu="*" @parcel/watcher@${pkg.dependencies["@parcel/watcher"]}`
}
for (const item of targets) {
  const name = [
    pkg.name,
    // changing to win32 flags npm for some reason
    item.os === "win32" ? "windows" : item.os,
    item.arch,
    item.avx2 === false ? "baseline" : undefined,
    item.abi === undefined ? undefined : item.abi,
  ]
    .filter(Boolean)
    .join("-")
  console.log(`building ${name}`)
  await $`mkdir -p dist/${name}/bin`

  const localPath = path.resolve(dir, "node_modules/@opentui/core/parser.worker.js")
  const rootPath = path.resolve(dir, "../../node_modules/@opentui/core/parser.worker.js")
  const parserWorker = fs.realpathSync(fs.existsSync(localPath) ? localPath : rootPath)
  const workerPath = "./src/cli/cmd/tui/worker.ts"

  // Use platform-specific bunfs root path based on target OS
  const bunfsRoot = item.os === "win32" ? "B:/~BUN/root/" : "/$bunfs/root/"
  const workerRelativePath = path.relative(dir, parserWorker).replaceAll("\\", "/")

  await Bun.build({
    conditions: ["browser"],
    tsconfig: "./tsconfig.json",
    plugins: [plugin],
    external: ["node-gyp"],
    format: "esm",
    minify: true,
    sourcemap: sourcemapsFlag ? "linked" : "none",
    splitting: true,
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      autoloadTsconfig: true,
      autoloadPackageJson: true,
      target: name.replace(pkg.name, "bun") as any,
      outfile: `dist/${name}/bin/deveco`,
      execArgv: [`--user-agent=opencode/${Script.version}`, "--use-system-ca", "--"],
      windows: {},
    },
    files: embeddedFileMap ? { "opencode-web-ui.gen.ts": embeddedFileMap } : {},
    entrypoints: ["./src/index.ts", parserWorker, workerPath, ...(embeddedFileMap ? ["opencode-web-ui.gen.ts"] : [])],
    define: {
      DEVECO_VERSION: `'${Script.version}'`,
      DEVECO_MIGRATIONS: JSON.stringify(migrations),
      OTUI_TREE_SITTER_WORKER_PATH: bunfsRoot + workerRelativePath,
      DEVECO_WORKER_PATH: workerPath,
      DEVECO_CHANNEL: `'${Script.channel}'`,
      DEVECO_LIBC: item.os === "linux" ? `'${item.abi ?? "glibc"}'` : "",
      DEVECO_DEFAULT_SKILLS: JSON.stringify(defaultSkillsData),
      DEVECO_DEFAULT_SPEC_RESOURCES: JSON.stringify(defaultSpecData),
    },
  })

  // Smoke test: only run if binary is for current platform
  if (item.os === process.platform && item.arch === process.arch && !item.abi) {
    const binaryPath = `dist/${name}/bin/deveco`
    console.log(`Running smoke test: ${binaryPath} --version`)
    try {
      const versionOutput = await $`${binaryPath} --version`.text()
      console.log(`Smoke test passed: ${versionOutput.trim()}`)
    } catch (e) {
      console.error(`Smoke test failed for ${name}:`, e)
      process.exit(1)
    }
  }

  // Copy mcp-bridge-native from cache
  const mcpKey = `${item.os}-${item.arch}`
  const mcpCache = path.join(mcpCacheDir, mcpKey)
  const cachedNode = path.join(mcpCache, "napi_bridge.node")
  if (!fs.existsSync(cachedNode)) {
    console.error(`  ERROR: mcp-bridge cache not found for ${mcpKey}. Run "bun install" first to download vendored binaries.`)
    process.exit(1)
  }
  {
    const vendorDir = path.join(dir, "dist", name, "vendor", "mcp-bridge-native")
    await fs.promises.mkdir(vendorDir, { recursive: true })
    await fs.promises.copyFile(path.join(mcpCache, "package.json"), path.join(vendorDir, "package.json"))
    await fs.promises.copyFile(cachedNode, path.join(vendorDir, "napi_bridge.node"))
    console.log(`  Bundled mcp-bridge for ${mcpKey}`)
  }

  // Copy ripgrep from cache
  const rgKey = `${item.os}-${item.arch}`
  const rgInfo = rgArchiveMap[rgKey]
  if (rgInfo) {
    const cachePath = path.join(rgCacheDir, rgKey, rgInfo.binary)
    if (!fs.existsSync(cachePath)) {
      console.error(`  ERROR: ripgrep cache not found for ${rgKey}. Run "bun install" first to download vendored binaries.`)
      process.exit(1)
    }
    const vendorDir = path.join(dir, "dist", name, "vendor", "ripgrep")
    await fs.promises.mkdir(vendorDir, { recursive: true })
    const rgBinaryName = item.os === "win32" ? "rg.exe" : "rg"
    const rgDest = path.join(vendorDir, rgBinaryName)
    await fs.promises.copyFile(cachePath, rgDest)
    if (item.os !== "win32") {
      await fs.promises.chmod(rgDest, 0o755)
    }
    console.log(`  Bundled ripgrep for ${rgKey}`)
  }

  await $`rm -rf ./dist/${name}/bin/tui`
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name: `@deveco/deveco-code-${item.os === "win32" ? "windows" : item.os}-${item.arch}`,
        version: Script.version,
        preferUnplugged: true,
        os: [item.os],
        cpu: [item.arch],
        files: [
          "bin/**/*",
          "vendor/**/*",
          "README.md",
        ],
      },
      null,
      2,
    ),
  )
  await $`cp ${path.join(dir, "README.md")} dist/${name}/README.md`
  binaries[name] = Script.version
}

if (Script.release) {
  for (const key of Object.keys(binaries)) {
    if (key.includes("linux")) {
      await $`tar -czf ../../${key}.tar.gz *`.cwd(`dist/${key}`)
    } else {
      await $`zip -r ../../${key}.zip *`.cwd(`dist/${key}`)
    }
  }
  await $`gh release upload v${Script.version} ./dist/*.zip ./dist/*.tar.gz --clobber --repo ${process.env.GH_REPO}`
}

export { binaries }
