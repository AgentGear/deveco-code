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

// Upgrade Node.js if version < 20 (Vite 7 requires Node 20.19+)
const nodeVersion = await $`node --version`.text().catch(() => "v0.0.0")
const nodeMajor = parseInt(nodeVersion.replace("v", "").split(".")[0])
if (nodeMajor < 20) {
  console.log(`Upgrading Node.js (current: ${nodeVersion.trim()})...`)
  const nodeDir = "/tmp/node22"
  await $`mkdir -p ${nodeDir}`
  await $`curl -fsSL https://npmmirror.com/mirrors/node/v22.14.0/node-v22.14.0-linux-x64.tar.xz | tar -xJ -C ${nodeDir} --strip-components=1`
  process.env.PATH = `${nodeDir}/bin:${process.env.PATH}`
  const newVersion = await $`node --version`.text()
  console.log(`  Node.js upgraded to ${newVersion.trim()}`)
}

await import("./generate.ts")

import { Script } from "@opencode-ai/script"
import pkg from "../package.json"

// Parse CLI arguments
const singleFlag = process.argv.includes("--single")
const skipInstall = process.argv.includes("--skip-install")
const skipEmbedWebUi = process.argv.includes("--skip-embed-web-ui")
const plugin = createSolidTransformPlugin()

console.log("=== Pipeline Build ===")
console.log(`Version:       ${Script.version}`)
console.log(`Channel:       ${Script.channel}`)
console.log(`Single:        ${singleFlag}`)
console.log(`Skip install:  ${skipInstall}`)

// Load migrations from migration directories
console.log("\n[1/5] Loading migrations...")
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

// Helper function to walk directory recursively
async function walk(directory: string): Promise<string[]> {
  const result: string[] = []
  async function recurse(dir: string) {
    for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
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

// Load default skills from resources/skills/
console.log("\n[2/5] Loading default skills...")
const defaultSkillsDir = path.join(dir, "resources/skills")
const defaultSkillsData: Record<string, Record<string, string>> = {}
if (fs.existsSync(defaultSkillsDir)) {
  for (const entry of await fs.promises.readdir(defaultSkillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const files: Record<string, string> = {}
    const skillPath = path.join(defaultSkillsDir, entry.name)
    for (const file of await walk(skillPath)) {
      const rel = path.relative(skillPath, file)
      files[rel] = await Bun.file(file).text()
    }
    defaultSkillsData[entry.name] = files
  }
}
console.log(`Loaded ${Object.keys(defaultSkillsData).length} default skills`)

// Load default spec resources from resources/spec/
console.log("\n[2.5/5] Loading default spec resources...")
const defaultSpecDir = path.join(dir, "resources/spec")
type EmbeddedFile = string | { encoding: "base64"; content: string }
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bin"])
const defaultSpecData: Record<string, Record<string, EmbeddedFile> | EmbeddedFile> = {}
if (fs.existsSync(defaultSpecDir)) {
  for (const entry of await fs.promises.readdir(defaultSpecDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const files: Record<string, EmbeddedFile> = {}
      const specPath = path.join(defaultSpecDir, entry.name)
      for (const file of await walk(specPath)) {
        const rel = path.relative(specPath, file)
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

// Build embedded Web UI bundle
const createEmbeddedWebUIBundle = async () => {
  console.log("\nBuilding Web UI to embed in the binary")
  const appDir = path.join(import.meta.dirname, "../../app")
  const dist = path.join(appDir, "dist")
  await $`bun run --cwd ${appDir} build`
  const files = (await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: dist })))
    .map((file) => file.replaceAll("\\", "/"))
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

// Define all build targets
console.log("\n[3/5] Configuring targets...")
const allTargets: {
  os: string
  arch: "arm64" | "x64"
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
  ? allTargets.filter((item) => item.os === process.platform && item.arch === process.arch)
  : allTargets

// Install cross-platform dependencies and download vendored binaries
console.log("\n[4/5] Installing dependencies...")
const cacheDir = path.join(dir, ".build-cache")
const rgCacheDir = path.join(cacheDir, "ripgrep")
const mcpCacheDir = path.join(cacheDir, "mcp-bridge")

const RG_VERSION = "15.1.0"
const supportedPlatforms = new Set(["darwin-arm64", "darwin-x64", "win32-x64"])

const rgArchiveMap: Record<string, { archive: string; binary: string }> = {
  "darwin-arm64": { archive: `ripgrep-${RG_VERSION}-aarch64-apple-darwin.tar.gz`, binary: "rg" },
  "darwin-x64":   { archive: `ripgrep-${RG_VERSION}-x86_64-apple-darwin.tar.gz`, binary: "rg" },
  "win32-x64":    { archive: `ripgrep-${RG_VERSION}-x86_64-pc-windows-msvc.zip`, binary: "rg.exe" },
}

if (!skipInstall) {
  await $`bun install --os="*" --cpu="*" @opentui/core@${pkg.dependencies["@opentui/core"]}`
  await $`bun install --os="*" --cpu="*" @parcel/watcher@${pkg.dependencies["@parcel/watcher"]}`

  // Download ripgrep for each needed platform
  const neededPlatforms = new Set(targets.map((t) => `${t.os}-${t.arch}`))
  const rgBase = process.env.RIPGREP_MIRROR_BASE || `https://github.com/BurntSushi/ripgrep/releases/download/${RG_VERSION}`

  for (const platform of neededPlatforms) {
    if (!supportedPlatforms.has(platform)) continue
    const info = rgArchiveMap[platform]
    if (!info) continue
    const cachePath = path.join(rgCacheDir, platform, info.binary)
    if (fs.existsSync(cachePath)) {
      console.log(`  rg for ${platform} already cached`)
      continue
    }
    const url = `${rgBase}/${info.archive}`
    console.log(`  Downloading rg for ${platform}...`)
    const cacheSubDir = path.join(rgCacheDir, platform)
    await $`mkdir -p ${cacheSubDir}`
    const archivePath = path.join(rgCacheDir, info.archive)
    await $`curl -sSfL --http1.1 --retry 3 --retry-delay 5 -o ${archivePath} ${url}`
    if (info.archive.endsWith(".tar.gz")) {
      await $`tar -xzf ${archivePath} -C ${cacheSubDir} --strip-components=1`
    } else {
      await $`unzip -o -j ${archivePath} "*/${info.binary}" -d ${cacheSubDir}`
    }
    await $`rm -f ${archivePath}`
    if (!platform.startsWith("win32")) {
      await fs.promises.chmod(cachePath, 0o755)
    }
    console.log(`  Cached rg for ${platform}`)
  }

  // Download mcp-bridge for each needed platform
  for (const platform of neededPlatforms) {
    if (!supportedPlatforms.has(platform)) continue
    const os = platform.split("-")[0]
    const arch = platform.split("-")[1]
    const pkgName = `@deveco-codegenie/mcp-bridge-${os}-${arch}`
    const cacheSubDir = path.join(mcpCacheDir, platform)
    const cachedNode = path.join(cacheSubDir, "napi_bridge.node")
    const cachedPkgJson = path.join(cacheSubDir, "package.json")
    if (fs.existsSync(cachedNode) && fs.existsSync(cachedPkgJson)) {
      console.log(`  mcp-bridge for ${platform} already cached`)
      continue
    }
    try {
      await $`mkdir -p ${cacheSubDir}`
      await $`bun install --os="*" --cpu="*" ${pkgName}@${(pkg.dependencies as Record<string, string>)["@deveco-codegenie/mcp-bridge"]}`.quiet()
      const nodeSrc = path.join(dir, "node_modules", pkgName, "napi_bridge.node")
      const pkgJsonSrc = path.join(dir, "node_modules", pkgName, "package.json")
      if (fs.existsSync(nodeSrc)) {
        await fs.promises.copyFile(nodeSrc, cachedNode)
        await fs.promises.copyFile(pkgJsonSrc, cachedPkgJson)
        console.log(`  Cached mcp-bridge for ${platform}`)
      } else {
        console.log(`  Skipping mcp-bridge for ${platform} (no native module)`)
      }
    } catch {
      console.log(`  Skipping mcp-bridge for ${platform} (install failed)`)
    }
  }
} else {
  console.log("  Skipping dependency installation (--skip-install)")
}

// Compile targets
console.log(`\n[5/5] Compiling ${targets.length} targets...`)
await $`rm -rf dist`

const binaries: Record<string, string> = {}

for (const item of targets) {
  const name = [
    pkg.name,
    item.os === "win32" ? "windows" : item.os,
    item.arch,
  ]
    .filter(Boolean)
    .join("-")
  console.log(`  building ${name}`)
  await $`mkdir -p dist/${name}/bin`

  const localPath = path.resolve(dir, "node_modules/@opentui/core/parser.worker.js")
  const rootPath = path.resolve(dir, "../../node_modules/@opentui/core/parser.worker.js")
  const parserWorker = fs.realpathSync(fs.existsSync(localPath) ? localPath : rootPath)
  const workerPath = "./src/cli/cmd/tui/worker.ts"

  const bunfsRoot = item.os === "win32" ? "B:/~BUN/root/" : "/$bunfs/root/"
  const workerRelativePath = path.relative(dir, parserWorker).replaceAll("\\", "/")

  await Bun.build({
    conditions: ["browser"],
    tsconfig: "./tsconfig.json",
    plugins: [plugin],
    external: ["node-gyp"],
    format: "esm",
    minify: true,
    splitting: true,
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      autoloadTsconfig: true,
      autoloadPackageJson: true,
      target: name.replace(pkg.name, "bun") as any,
      outfile: `dist/${name}/bin/deveco`,
      execArgv: [`--user-agent=deveco/${Script.version}`, "--use-system-ca", "--"],
      windows: {},
    },
    files: embeddedFileMap ? { "opencode-web-ui.gen.ts": embeddedFileMap } : {},
    entrypoints: ["./src/index.ts", parserWorker, workerPath, ...(embeddedFileMap ? ["opencode-web-ui.gen.ts"] : [])],
    define: {
      DEVECO_VERSION: `'${Script.version}'`,
      DEVECO_MIGRATIONS: JSON.stringify(migrations),
      DEVECO_DEFAULT_SKILLS: JSON.stringify(defaultSkillsData),
      DEVECO_DEFAULT_SPEC_RESOURCES: JSON.stringify(defaultSpecData),
      OTUI_TREE_SITTER_WORKER_PATH: bunfsRoot + workerRelativePath,
      DEVECO_WORKER_PATH: workerPath,
      DEVECO_CHANNEL: `'${Script.channel}'`,
    },
  })

  // Copy mcp-bridge-native from cache
  const mcpKey = `${item.os}-${item.arch}`
  const mcpCache = path.join(mcpCacheDir, mcpKey)
  const cachedNode = path.join(mcpCache, "napi_bridge.node")
  if (fs.existsSync(cachedNode)) {
    const vendorDir = path.join(dir, "dist", name, "vendor", "mcp-bridge-native")
    await fs.promises.mkdir(vendorDir, { recursive: true })
    await fs.promises.copyFile(path.join(mcpCache, "package.json"), path.join(vendorDir, "package.json"))
    await fs.promises.copyFile(cachedNode, path.join(vendorDir, "napi_bridge.node"))
    console.log(`    Bundled mcp-bridge for ${mcpKey}`)
  }

  // Copy ripgrep from cache
  const rgKey = `${item.os}-${item.arch}`
  const rgInfo = rgArchiveMap[rgKey]
  if (rgInfo) {
    const cachePath = path.join(rgCacheDir, rgKey, rgInfo.binary)
    if (fs.existsSync(cachePath)) {
      const vendorDir = path.join(dir, "dist", name, "vendor", "ripgrep")
      await fs.promises.mkdir(vendorDir, { recursive: true })
      const rgBinaryName = item.os === "win32" ? "rg.exe" : "rg"
      const rgDest = path.join(vendorDir, rgBinaryName)
      await fs.promises.copyFile(cachePath, rgDest)
      if (item.os !== "win32") {
        await fs.promises.chmod(rgDest, 0o755)
      }
      console.log(`    Bundled ripgrep for ${rgKey}`)
    }
  }

  // Smoke test: only run if binary is for current platform
  if (item.os === process.platform && item.arch === process.arch) {
    const binaryPath = `dist/${name}/bin/deveco`
    console.log(`    Running smoke test: ${binaryPath} --version`)
    try {
      const versionOutput = await $`${binaryPath} --version`.text()
      console.log(`    Smoke test passed: ${versionOutput.trim()}`)
    } catch (e) {
      console.error(`    Smoke test failed for ${name}:`, e)
      process.exit(1)
    }
  }

  await $`rm -rf ./dist/${name}/bin/tui`
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name: `@deveco/${name}`,
        version: Script.version,
        os: [item.os],
        cpu: [item.arch],
        files: [
          "bin/**/*",
          "vendor/**/*",
        ],
      },
      null,
      2,
    ),
  )
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

console.log("\n=== Pipeline Build Complete ===")
console.log(`Built ${Object.keys(binaries).length} targets: ${Object.keys(binaries).join(", ")}`)

export { binaries }
