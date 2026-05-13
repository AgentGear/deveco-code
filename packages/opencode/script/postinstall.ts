#!/usr/bin/env bun
/**
 * Download ripgrep and mcp-bridge binaries to .build-cache/.
 *
 * Run automatically via `bun install` (postinstall hook),
 * or manually: `bun run script/postinstall.ts`
 *
 * Idempotent — skips download if the binary already exists in .build-cache.
 *
 * Environment:
 * - HTTPS_PROXY / HTTP_PROXY — when set, download uses `undici` + EnvHttpProxyAgent.
 * - RIPGREP_DOWNLOAD_BASE — override ripgrep release URL prefix (default: ghproxy.net mirror).
 * - NPM_REGISTRY — override npm registry for mcp-bridge (default: https://registry.npmmirror.com).
 */

import fs from "fs"
import path from "path"
import { chmodSync, mkdirSync, renameSync, writeFileSync } from "fs"
import { spawnSync } from "child_process"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

import pkg from "../package.json" with { type: "json" }

// --- Config ---

const RG_VERSION = "15.1.0"
const DEFAULT_RG_BASE = `https://ghproxy.net/https://github.com/BurntSushi/ripgrep/releases/download/${RG_VERSION}`
const RG_BASE = (process.env.RIPGREP_DOWNLOAD_BASE ?? DEFAULT_RG_BASE).replace(/\/$/, "")

const cacheDir = path.join(dir, ".build-cache")
const rgCacheDir = path.join(cacheDir, "ripgrep")
const mcpCacheDir = path.join(cacheDir, "mcp-bridge")

const supportedPlatforms = new Set(["darwin-arm64", "darwin-x64", "win32-x64"])

const rgArchiveMap: Record<string, { archive: string; binary: string }> = {
  "darwin-arm64": { archive: `ripgrep-${RG_VERSION}-aarch64-apple-darwin.tar.gz`, binary: "rg" },
  "darwin-x64":   { archive: `ripgrep-${RG_VERSION}-x86_64-apple-darwin.tar.gz`, binary: "rg" },
  "win32-x64":    { archive: `ripgrep-${RG_VERSION}-x86_64-pc-windows-msvc.zip`, binary: "rg.exe" },
}

// --- Download helpers ---

function proxyEnvSet(): boolean {
  const v = (s: string | undefined) => (s ?? "").trim()
  return !!(v(process.env.HTTPS_PROXY) || v(process.env.HTTP_PROXY) || v(process.env.ALL_PROXY))
}

async function fetchWithProxy(url: string): Promise<Response> {
  if (proxyEnvSet()) {
    // @ts-ignore — undici is bundled by Bun at runtime
    const { EnvHttpProxyAgent, fetch: undiciFetch } = await import("undici")
    return (await undiciFetch(url, {
      redirect: "follow",
      dispatcher: new EnvHttpProxyAgent(),
    })) as unknown as Response
  }
  return await fetch(url, { redirect: "follow" })
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const response = await fetchWithProxy(url)
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

// --- Ripgrep ---

async function downloadRipgrep(platform: string) {
  const info = rgArchiveMap[platform]
  if (!info) return

  const cachePath = path.join(rgCacheDir, platform, info.binary)
  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
    return
  }

  const url = `${RG_BASE}/${info.archive}`
  console.log(`  Downloading rg for ${platform}...`)

  const cacheSubDir = path.join(rgCacheDir, platform)
  mkdirSync(cacheSubDir, { recursive: true })

  const buffer = await downloadBuffer(url)
  console.log(`  Downloaded ${Math.round(buffer.length / 1024)} KB`)

  if (info.archive.endsWith(".tar.gz")) {
    const tmpDir = path.join(cacheSubDir, ".tmp-download")
    fs.rmSync(tmpDir, { recursive: true, force: true })
    mkdirSync(tmpDir, { recursive: true })
    try {
      const archivePath = path.join(tmpDir, info.archive)
      writeFileSync(archivePath, buffer)
      const result = spawnSync("tar", ["xzf", archivePath, "-C", tmpDir, "--strip-components=1"], { stdio: "pipe" })
      if (result.status !== 0) {
        throw new Error(`tar extract failed: ${result.stderr?.toString()}`)
      }
      renameSync(path.join(tmpDir, info.binary), cachePath)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  } else {
    // zip — use system unzip
    const tmpDir = path.join(cacheSubDir, ".tmp-download")
    fs.rmSync(tmpDir, { recursive: true, force: true })
    mkdirSync(tmpDir, { recursive: true })
    try {
      const archivePath = path.join(tmpDir, info.archive)
      writeFileSync(archivePath, buffer)
      const result = spawnSync("unzip", ["-o", archivePath, "-d", tmpDir], { stdio: "pipe" })
      if (result.status !== 0) {
        throw new Error(`unzip failed: ${result.stderr?.toString()}`)
      }
      const findBinary = (d: string): string | null => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, entry.name)
          if (entry.isDirectory()) {
            const found = findBinary(full)
            if (found) return found
          } else if (entry.name === info.binary) {
            return full
          }
        }
        return null
      }
      const binaryPath = findBinary(tmpDir)
      if (!binaryPath) throw new Error(`Binary ${info.binary} not found in zip`)
      renameSync(binaryPath, cachePath)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }

  if (!platform.startsWith("win32")) {
    chmodSync(cachePath, 0o755)
  }
  console.log(`  Cached rg for ${platform}`)
}

// --- mcp-bridge ---

async function downloadMcpBridge(platform: string) {
  const os_ = platform.split("-")[0]
  const arch = platform.split("-")[1]
  const pkgName = `@deveco-codegenie/mcp-bridge-${os_}-${arch}`
  const version = (pkg.dependencies as Record<string, string>)["@deveco-codegenie/mcp-bridge"]
  const cacheSubDir = path.join(mcpCacheDir, platform)
  const cachedNode = path.join(cacheSubDir, "napi_bridge.node")
  const cachedPkgJson = path.join(cacheSubDir, "package.json")

  if (fs.existsSync(cachedNode) && fs.existsSync(cachedPkgJson)) {
    return
  }

  mkdirSync(cacheSubDir, { recursive: true })
  const registry = (process.env.NPM_REGISTRY ?? "https://registry.npmmirror.com").replace(/\/$/, "")
  const tarballUrl = `${registry}/${pkgName}/-/${pkgName.split("/")[1]}-${version}.tgz`
  console.log(`  Downloading mcp-bridge for ${platform}...`)

  const buffer = await downloadBuffer(tarballUrl)
  console.log(`  Downloaded ${Math.round(buffer.length / 1024)} KB`)

  const tmpDir = path.join(cacheSubDir, ".tmp-download")
  fs.rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(tmpDir, { recursive: true })
  try {
    const archivePath = path.join(tmpDir, "package.tgz")
    writeFileSync(archivePath, buffer)
    const result = spawnSync("tar", ["xzf", archivePath, "-C", tmpDir, "--strip-components=1"], { stdio: "pipe" })
    if (result.status !== 0) {
      throw new Error(`tar extract failed: ${result.stderr?.toString()}`)
    }
    const extractedNode = path.join(tmpDir, "napi_bridge.node")
    const extractedPkgJson = path.join(tmpDir, "package.json")
    if (fs.existsSync(extractedNode)) {
      renameSync(extractedNode, cachedNode)
      renameSync(extractedPkgJson, cachedPkgJson)
      console.log(`  Cached mcp-bridge for ${platform}`)
    } else {
      throw new Error("napi_bridge.node not found in tarball")
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

// --- Main ---

const platforms = Array.from(supportedPlatforms)

console.log(`Downloading vendored binaries... (${platforms.join(", ")})`)
for (const platform of platforms) {
  await downloadRipgrep(platform).catch((e) => console.log(`  Failed to download rg for ${platform}: ${e.message}`))
  await downloadMcpBridge(platform).catch((e) => console.log(`  Failed to download mcp-bridge for ${platform}: ${e.message}`))
}
console.log("Done.")
