import { RGBA } from "@opentui/core"
import { EOL } from "os"

/** 8x11 rows from Downloads/test_ansi/8x11; parsed as SGR spans in the TUI. */
const ansiC = [
  `  \u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582`,
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582`,
  `\u2583\u2583\u2583        `,
  `\u2584\u2584\u2584        `,
  `\u2584\u2584\u2584        `,
  `\u2585\u2585\u2585        `,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
  `  \u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
]

const ansiO = [
  `  \u2582\u2582\u2582\u2582\u2582\u2582\u2582  `,
  ` \u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582 `,
  `\u2583\u2583\u2583     \u2583\u2583\u2583`,
  `\u2584\u2584\u2584     \u2584\u2584\u2584`,
  `\u2584\u2584\u2584     \u2584\u2584\u2584`,
  `\u2585\u2585\u2585     \u2585\u2585\u2585`,
  ` \u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586 `,
  `  \u2586\u2586\u2586\u2586\u2586\u2586\u2586  `,
]

const ansiD = [
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582  `,
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582 `,
  `\u2583\u2583\u2583     \u2583\u2583\u2583`,
  `\u2584\u2584\u2584     \u2584\u2584\u2584`,
  `\u2584\u2584\u2584     \u2584\u2584\u2584`,
  `\u2585\u2585\u2585     \u2585\u2585\u2585`,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586 `,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586  `,
]

const ansiE = [
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582`,
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582`,
  `\u2583\u2583\u2583        `,
  `\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584  `,
  `\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584  `,
  `\u2585\u2585\u2585        `,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
]

const ansiG = [
  `  \u2582\u2582\u2582\u2582\u2582\u2582\u2582  `,
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582`,
  `\u2583\u2583\u2583        `,
  `\u2584\u2584\u2584        `,
  `\u2584\u2584\u2584    \u2584\u2584\u2584\u2584`,
  `\u2585\u2585\u2585     \u2585\u2585\u2585`,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
  `  \u2586\u2586\u2586\u2586\u2586\u2586\u2586  `,
]

const ansiN = [
  `\u2582\u2582      \u2582\u2582\u2582`,
  `\u2582\u2582\u2582     \u2582\u2582\u2582`,
  `\u2583\u2583\u2583\u2583    \u2583\u2583\u2583`,
  `\u2584\u2584\u2584\u2584\u2584   \u2584\u2584\u2584`,
  `\u2584\u2584\u2584  \u2584\u2584\u2584\u2584\u2584\u2584`,
  `\u2585\u2585\u2585    \u2585\u2585\u2585\u2585`,
  `\u2586\u2586\u2586     \u2586\u2586\u2586`,
  `\u2586\u2586\u2586      \u2586\u2586`,
]

const ansiI = [
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582`,
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582`,
  `    \u2583\u2583\u2583    `,
  `    \u2584\u2584\u2584    `,
  `    \u2584\u2584\u2584    `,
  `    \u2585\u2585\u2585    `,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
]

export const wordFull = ansiC.map(
  (c, i) =>
    `${c} ${ansiO[i] ?? ""}  ${ansiD[i] ?? ""}  ${ansiE[i] ?? ""}  ${ansiG[i] ?? ""}  ${ansiE[i] ?? ""}  ${ansiN[i] ?? ""}  ${ansiI[i] ?? ""}  ${ansiE[i] ?? ""}`,
)

export const wordGOnly = ansiG

export type Tone = { t: string; fg: RGBA }

export function logoRowsForWidth(width: number): readonly string[] {
  return width < 115 ? wordGOnly : wordFull
}

/** Light banner: if theme border is too close to white, use a fixed mid-gray for scanlines/rules. */
export function stripeLineForLight(border: RGBA): RGBA {
  const lum = (0.299 * border.r + 0.587 * border.g + 0.114 * border.b) / 255
  if (lum > 0.72) return RGBA.fromInts(120, 120, 120)
  return border
}

export function padTones(parts: Tone[], w: number, base: RGBA): Tone[] {
  const n = parts.reduce((a, p) => a + p.t.length, 0)
  if (w <= 0 || n >= w) return parts
  const l = Math.floor((w - n) / 2)
  const r = w - n - l
  const head = l > 0 ? [{ t: " ".repeat(l), fg: base }] : []
  const tail = r > 0 ? [{ t: " ".repeat(r), fg: base }] : []
  return [...head, ...parts, ...tail]
}

export function scanline(parts: Tone[], fg: RGBA): Tone[] {
  const out: Tone[] = []
  let buf = ""
  let cur = fg

  const flush = () => {
    if (!buf) return
    out.push({ t: buf, fg: cur })
    buf = ""
  }

  for (const p of parts) {
    for (const ch of p.t) {
      const isSpace = ch === " "
      const nextFg = isSpace ? fg : p.fg
      const nextCh = isSpace ? "─" : ch
      if (nextFg !== cur) {
        flush()
        cur = nextFg
      }
      buf += nextCh
    }
  }
  flush()
  return out
}

export type BannerLogoPalette = {
  logoFg: RGBA
  stripeLine: RGBA
  base: RGBA
}

export function bannerLogoPalette(
  isLight: boolean,
  theme: { text: RGBA; textMuted: RGBA; border: RGBA },
): BannerLogoPalette {
  if (!isLight) {
    return {
      logoFg: RGBA.fromInts(255, 255, 255),
      stripeLine: RGBA.fromInts(58, 58, 58),
      base: theme.textMuted,
    }
  }

  return {
    logoFg: theme.text,
    stripeLine: stripeLineForLight(theme.border),
    base: theme.textMuted,
  }
}

function ansiTruecolorFg(fg: RGBA): string {
  const r = Math.round(Math.min(255, Math.max(0, fg.r * 255)))
  const g = Math.round(Math.min(255, Math.max(0, fg.g * 255)))
  const b = Math.round(Math.min(255, Math.max(0, fg.b * 255)))
  return `\x1b[38;2;${r};${g};${b}m`
}

/** Lettermark as stdout ANSI lines (truecolor SGR). Padded like `<Banner />`, without scanline/stripe (`─` fill). */
export function formatBannerLogoAnsiLines(width: number, palette: BannerLogoPalette): string[] {
  const w = Math.max(0, Math.floor(width))
  const rows = logoRowsForWidth(w)
  const reset = "\x1b[0m"
  const lines: string[] = []

  for (const line of rows) {
    const parts = padTones([{ t: line, fg: palette.logoFg }], w, palette.base)
    let s = ""
    let prevKey = ""
    for (const p of parts) {
      const key = `${Math.round(p.fg.r * 255)},${Math.round(p.fg.g * 255)},${Math.round(p.fg.b * 255)}`
      if (key !== prevKey) {
        s += ansiTruecolorFg(p.fg)
        prevKey = key
      }
      s += p.t
    }
    lines.push(s + reset)
  }

  return lines
}

/** Dark-style palette when no TUI theme is available (e.g. `codegenie -h` on stderr). */
export function cliHelpBannerLogoPalette(): BannerLogoPalette {
  return {
    logoFg: RGBA.fromInts(255, 255, 255),
    stripeLine: RGBA.fromInts(58, 58, 58),
    base: RGBA.fromInts(158, 158, 158),
  }
}

/** Banner lettermark for CLI help output; no scanline/stripe. Uses terminal width or 80 columns. */
export function formatCliHelpBannerLogoBlock(columns: number | undefined): string {
  const w = typeof columns === "number" && columns > 0 ? columns : 80
  return formatBannerLogoAnsiLines(w, cliHelpBannerLogoPalette()).join(EOL)
}
