import z from "zod"
import { EOL } from "os"
import { Schema } from "effect"
import { NamedError } from "@opencode-ai/core/util/error"
import { logo as glyphs, marks } from "./logo"

type LogoGlyphs = typeof glyphs & {
  charMap?: Record<string, string>
  charOpacity?: Record<string, number>
}

type LogoRightPart = { text: string; mute: boolean; link: boolean }

function parseLogoRightSegments(line: string): LogoRightPart[] {
  const parts: LogoRightPart[] = []
  let s = line
  while (s.length > 0) {
    if (s.startsWith("{muted}")) {
      s = s.slice(7)
      const j = s.indexOf("{/muted}")
      if (j === -1) {
        break
      }
      parts.push({ text: s.slice(0, j), mute: true, link: false })
      s = s.slice(j + 8)
      continue
    }
    if (s.startsWith("{link}")) {
      s = s.slice(6)
      const j = s.indexOf("{/link}")
      if (j === -1) {
        break
      }
      parts.push({ text: s.slice(0, j), mute: false, link: true })
      s = s.slice(j + 7)
      continue
    }
    const a = s.indexOf("{muted}")
    const b = s.indexOf("{link}")
    const candidates = [a, b].filter((x) => x >= 0)
    const n = candidates.length ? Math.min(...candidates) : s.length
    const plain = s.slice(0, n)
    if (plain) {
      parts.push({ text: plain, mute: false, link: false })
    }
    s = s.slice(n)
  }
  return parts
}

export namespace UI {
  export const CancelledError = NamedError.create("UICancelledError", Schema.Void)

  export const Style = {
    TEXT_HIGHLIGHT: "\x1b[96m",
    TEXT_HIGHLIGHT_BOLD: "\x1b[96m\x1b[1m",
    TEXT_DIM: "\x1b[90m",
    TEXT_DIM_BOLD: "\x1b[90m\x1b[1m",
    TEXT_NORMAL: "\x1b[0m",
    TEXT_NORMAL_BOLD: "\x1b[1m",
    TEXT_WARNING: "\x1b[93m",
    TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m",
    TEXT_DANGER: "\x1b[91m",
    TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m",
    TEXT_SUCCESS: "\x1b[92m",
    TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m",
    TEXT_INFO: "\x1b[94m",
    TEXT_INFO_BOLD: "\x1b[94m\x1b[1m",
  }

  export function println(...message: string[]) {
    print(...message)
    process.stderr.write(EOL)
  }

  export function print(...message: string[]) {
    blank = false
    process.stderr.write(message.join(" "))
  }

  let blank = false
  export function empty() {
    if (blank) return
    println("" + Style.TEXT_NORMAL)
    blank = true
  }

  export function logo(pad?: string) {
    const result: string[] = []
    const reset = "\x1b[0m"
    const g = glyphs as LogoGlyphs
    const maxLeftWidth = Math.max(0, ...g.left.map((row) => row.length))
    const shadowMarkerRe = new RegExp(`[${marks}]`)

    const getGradientColor = (position: number, totalWidth: number) => {
      const ratio = totalWidth <= 0 ? 0 : Math.max(0, Math.min(1, position / totalWidth))
      return {
        r: Math.round(77 + (220 - 77) * ratio),
        g: Math.round(43 + (73 - 43) * ratio),
        b: Math.round(251 + (170 - 251) * ratio),
      }
    }

    const tintTowardDark = (rgb: { r: number; g: number; b: number }, alpha: number) => {
      const br = 12
      const bg = 12
      const bb = 24
      return {
        r: Math.round(rgb.r * alpha + br * (1 - alpha)),
        g: Math.round(rgb.g * alpha + bg * (1 - alpha)),
        b: Math.round(rgb.b * alpha + bb * (1 - alpha)),
      }
    }

    const ansiFg = (rgb: { r: number; g: number; b: number }) => `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m`
    const ansiBg = (rgb: { r: number; g: number; b: number }) => `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m`

    const drawLeftGradient = (line: string): string => {
      const parts: string[] = []
      let i = 0
      while (i < line.length) {
        const rest = line.slice(i)
        const mi = rest.search(shadowMarkerRe)
        const markerIndex = mi === -1 ? rest.length : mi

        for (let j = 0; j < markerIndex; j++) {
          const idx = i + j
          let ch = line[idx]!
          const src = ch
          if (g.charMap?.[ch]) {
            ch = g.charMap[ch]!
          }
          if (ch === " ") {
            parts.push(" ")
            continue
          }
          let rgb = getGradientColor(idx, maxLeftWidth)
          const op = g.charOpacity?.[src]
          if (typeof op === "number") {
            rgb = tintTowardDark(rgb, op)
          }
          parts.push(ansiFg(rgb), ch, reset)
        }

        if (markerIndex >= rest.length) {
          break
        }

        const marker = rest[markerIndex]!
        const pos = i + markerIndex
        const fgRgb = getGradientColor(pos, maxLeftWidth)
        const shRgb = tintTowardDark(fgRgb, 0.45)

        if (marker === "_") {
          parts.push(ansiFg(fgRgb), ansiBg(shRgb), " ", reset)
        } else if (marker === "^") {
          parts.push(ansiFg(fgRgb), ansiBg(shRgb), "▀", reset)
        } else if (marker === "~") {
          parts.push(ansiFg(shRgb), "▀", reset)
        }

        i += markerIndex + 1
      }
      return parts.join("")
    }

    const right = {
      fg: "\x1b[1m\x1b[39m",
      shadow: "\x1b[2m\x1b[39m",
      bg: "\x1b[48;5;236m",
    }
    const gap = " "
    const draw = (line: string, fg: string, shadow: string, bg: string) => {
      const parts: string[] = []
      for (const char of line) {
        if (char === "_") {
          parts.push(bg, " ", reset)
          continue
        }
        if (char === "^") {
          parts.push(fg, bg, "▀", reset)
          continue
        }
        if (char === "~") {
          parts.push(shadow, "▀", reset)
          continue
        }
        if (char === " ") {
          parts.push(" ")
          continue
        }
        parts.push(fg, char, reset)
      }
      return parts.join("")
    }

    const drawRight = (line: string): string => {
      const hasTags = line.includes("{muted}") || line.includes("{link}")
      if (!hasTags) {
        return draw(line, right.fg, right.shadow, right.bg)
      }
      const segments = parseLogoRightSegments(line)
      if (segments.length === 0) {
        const stripped = line.replace(/\{muted\}|\{\/muted\}|\{link\}|\{\/link\}/g, "")
        return draw(stripped, right.fg, right.shadow, right.bg)
      }
      return segments
        .map((p) => {
          const fg = p.mute ? UI.Style.TEXT_DIM : p.link ? UI.Style.TEXT_INFO : right.fg
          return draw(p.text, fg, right.shadow, right.bg)
        })
        .join("")
    }

    g.left.forEach((row, index) => {
      if (pad) {
        result.push(pad)
      }
      result.push(drawLeftGradient(row))
      result.push(gap)
      const other = g.right[index] ?? ""
      result.push(drawRight(other))
      result.push(EOL)
    })
    return result.join("").trimEnd()
  }

  export async function input(prompt: string): Promise<string> {
    const readline = require("readline")
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question(prompt, (answer: string) => {
        rl.close()
        resolve(answer.trim())
      })
    })
  }

  export function error(message: string) {
    if (message.startsWith("Error: ")) {
      message = message.slice("Error: ".length)
    }
    println(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message)
  }

  export function markdown(text: string): string {
    return text
  }
}