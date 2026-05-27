import { execSync } from "child_process"
import fs from "fs"
import path from "path"

let cached: boolean | undefined

/** Cached CLI terminal light/dark detection for banner ANSI output. */
export function detectCliTerminalLight(): boolean {
  if (cached !== undefined) return cached
  cached = detectOnce()
  return cached
}

function detectOnce(): boolean {
  const fromColorfgbg = parseColorFgbg(process.env.COLORFGBG)
  if (fromColorfgbg !== undefined) return fromColorfgbg

  if (process.platform === "win32") {
    if (isWarpTerminal()) {
      const fromWarp = readWarpThemeLight()
      if (fromWarp !== undefined) return fromWarp
    }
    if (isWindowsTerminal()) {
      const fromWt = readWindowsTerminalThemeLight()
      if (fromWt !== undefined) return fromWt
    }
    return false
  }

  const fromOsc = queryOsc11IsLight()
  if (fromOsc !== undefined) return fromOsc

  return false
}

export function isWarpTerminal(): boolean {
  return (
    process.env.TERM_PROGRAM === "WarpTerminal" ||
    process.env.WARP_IS_LOCAL_SHELL_SESSION === "1"
  )
}

export function isWindowsTerminal(): boolean {
  return process.env.WT_SESSION !== undefined
}

export function parseColorFgbg(colorfgbg: string | undefined): boolean | undefined {
  if (!colorfgbg) return undefined

  const segments = colorfgbg.split(";")
  const rgb = segments.find((s) => s.startsWith("rgb:"))
  if (rgb) {
    const m = rgb.match(/^rgb:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})$/i)
    if (m) return isLightRgb(channel(m[1]!), channel(m[2]!), channel(m[3]!))
  }

  const bg = Number.parseInt(segments[1] ?? "", 10)
  if (Number.isFinite(bg)) return bg >= 8

  return undefined
}

function channel(v: string): number {
  const n = Number.parseInt(v, 16)
  return v.length <= 2 ? n / 255 : n / 65535
}

function isLightRgb(r: number, g: number, b: number): boolean {
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.5
}

function queryOsc11IsLight(): boolean | undefined {
  if (!process.stdin.isTTY) return undefined

  const out = process.stdout.isTTY ? process.stdout : process.stderr.isTTY ? process.stderr : undefined
  if (!out) return undefined

  out.write("\x1b]11;?\x07")

  const deadline = Date.now() + 150
  let data = ""
  const buf = Buffer.alloc(128)

  while (Date.now() < deadline) {
    if (!stdinHasBytes()) {
      Bun.sleepSync(5)
      continue
    }

    try {
      const n = fs.readSync(process.stdin.fd, buf, 0, buf.length, null)
      if (n <= 0) break
      data += buf.toString("utf8", 0, n)
      if (/\x07|\x1b\\/.test(data) && /rgb:|#/.test(data)) break
    } catch {
      break
    }
  }

  drainStdin(50)

  const rgb = parseOsc11(data)
  if (!rgb) return undefined
  return isLightRgb(rgb.r, rgb.g, rgb.b)
}

function drainStdin(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  const buf = Buffer.alloc(256)

  while (Date.now() < deadline) {
    if (!stdinHasBytes()) {
      Bun.sleepSync(5)
      continue
    }

    try {
      fs.readSync(process.stdin.fd, buf, 0, buf.length, null)
    } catch {
      break
    }
  }
}

function parseOsc11(data: string): { r: number; g: number; b: number } | undefined {
  const rgb = data.match(/11;rgb:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})/i)
  if (rgb) {
    return { r: channel(rgb[1]!), g: channel(rgb[2]!), b: channel(rgb[3]!) }
  }

  const hex = data.match(/11;#([0-9a-f]{6})/i)
  if (hex) {
    const n = hex[1]!
    return {
      r: Number.parseInt(n.slice(0, 2), 16) / 255,
      g: Number.parseInt(n.slice(2, 4), 16) / 255,
      b: Number.parseInt(n.slice(4, 6), 16) / 255,
    }
  }

  return undefined
}

function stdinHasBytes(): boolean {
  try {
    const { fcntlSync, constants } = fs
    if (!constants?.O_NONBLOCK) return false
    const fd = process.stdin.fd
    const flags = fcntlSync(fd, constants.F_GETFL)
    fcntlSync(fd, constants.F_SETFL, flags | constants.O_NONBLOCK)
    const buf = Buffer.alloc(1)
    try {
      return fs.readSync(fd, buf, 0, 1, null) > 0
    } catch (e) {
      return (e as NodeJS.ErrnoException).code === "EAGAIN"
    } finally {
      fcntlSync(fd, constants.F_SETFL, flags)
    }
  } catch {
    return false
  }
}

export function warpThemeNameIsLight(name: string): boolean | undefined {
  const n = name.toLowerCase()
  if (n === "light" || n.endsWith("_light")) return true
  if (n === "dark" || n.endsWith("_dark")) return false
  if (new Set(["snowy", "marble", "leafy", "koi", "jellyfish", "pink_city", "adeberry"]).has(n)) {
    return true
  }
  return undefined
}

export function windowsTerminalSchemeIsLight(
  schemeName: string | undefined,
  schemes: ReadonlyArray<{ name?: string; background?: string }> | undefined,
): boolean | undefined {
  if (!schemeName) return undefined

  const byName = schemeName.toLowerCase()
  if (byName.includes("light")) return true
  if (byName.includes("dark")) return false

  const scheme = schemes?.find((s) => s.name === schemeName)
  if (!scheme?.background) return undefined

  return hexBackgroundLight(scheme.background)
}

function hexBackgroundLight(hex: string): boolean | undefined {
  const m = hex.match(/^#?([0-9a-f]{6})$/i)
  if (!m) return undefined
  const n = m[1]!
  const r = Number.parseInt(n.slice(0, 2), 16) / 255
  const g = Number.parseInt(n.slice(2, 4), 16) / 255
  const b = Number.parseInt(n.slice(4, 6), 16) / 255
  return isLightRgb(r, g, b)
}

function readWarpThemeLight(): boolean | undefined {
  const local = process.env.LOCALAPPDATA
  if (!local) return undefined

  const roots = [
    path.join(local, "warp", "Warp", "config"),
    path.join(local, "warp-preview", "WarpPreview", "config"),
  ]

  for (const root of roots) {
    const file = path.join(root, "settings.toml")
    if (!fs.existsSync(file)) continue

    const text = fs.readFileSync(file, "utf8")
    const section = text.match(/\[appearance\.themes\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? text

    if (/system_theme\s*=\s*true/.test(section)) {
      const os = readWindowsAppsLightTheme()
      if (os !== undefined) return os
    }

    const theme = section.match(/^\s*theme\s*=\s*"([^"]+)"/m)?.[1]
    if (!theme) continue

    const light = warpThemeNameIsLight(theme)
    if (light !== undefined) return light
  }

  return undefined
}

function readWindowsTerminalThemeLight(): boolean | undefined {
  const local = process.env.LOCALAPPDATA
  if (!local) return undefined

  const paths = [
    path.join(local, "Packages", "Microsoft.WindowsTerminal_8wekyb3d8bbwe", "LocalState", "settings.json"),
    path.join(local, "Packages", "Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe", "LocalState", "settings.json"),
    path.join(local, "Microsoft", "Windows Terminal", "settings.json"),
  ]

  for (const file of paths) {
    if (!fs.existsSync(file)) continue

    try {
      const settings = JSON.parse(fs.readFileSync(file, "utf8")) as {
        defaultProfile?: string
        schemes?: Array<{ name?: string; background?: string }>
        profiles?: {
          defaults?: { colorScheme?: string }
          list?: Array<{ guid?: string; colorScheme?: string }>
        }
      }

      const profiles = settings.profiles
      if (!profiles) continue

      let schemeName = profiles.defaults?.colorScheme
      const defaultGuid = settings.defaultProfile
      if (defaultGuid && profiles.list) {
        const profile = profiles.list.find((p) => p.guid === defaultGuid)
        if (profile?.colorScheme) schemeName = profile.colorScheme
      }

      const light = windowsTerminalSchemeIsLight(schemeName, settings.schemes)
      if (light !== undefined) return light
    } catch {
      continue
    }
  }

  return undefined
}

function readWindowsAppsLightTheme(): boolean | undefined {
  if (process.platform !== "win32") return undefined

  try {
    const out = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v AppsUseLightTheme',
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
    )
    const m = out.match(/AppsUseLightTheme\s+REG_DWORD\s+0x([0-9a-f]+)/i)
    if (!m) return undefined
    return Number.parseInt(m[1]!, 16) === 1
  } catch {
    return undefined
  }
}
