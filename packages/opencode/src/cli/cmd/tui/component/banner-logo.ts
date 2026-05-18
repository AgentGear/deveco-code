import { RGBA } from "@opentui/core"
import { EOL } from "os"

/** 8x11 rows from Downloads/test_ansi/8x11; parsed as SGR spans in the TUI. */
const ansiC = [
  `  \u2582\u2582\u2582\u2582\u2582  `,
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582`,
  `\u2583\u2583\u2583   \u2583\u2583\u2583`,
  `\u2584\u2584\u2584      `,
  `\u2584\u2584\u2584      `,
  `\u2585\u2585\u2585   \u2585\u2585\u2585`,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
  `  \u2586\u2586\u2586\u2586\u2586  `,
]

const ansiO = [
  ` \u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582 `,
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582`,
  `\u2583\u2583\u2583    \u2583\u2583\u2583`,
  `\u2584\u2584\u2584    \u2584\u2584\u2584`,
  `\u2584\u2584\u2584    \u2584\u2584\u2584`,
  `\u2585\u2585\u2585    \u2585\u2585\u2585`,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
  ` \u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586 `,
]

const ansiD = [
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582  `,
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582 `,
  `\u2583\u2583\u2583    \u2583\u2583\u2583`,
  `\u2584\u2584\u2584    \u2584\u2584\u2584`,
  `\u2584\u2584\u2584    \u2584\u2584\u2584`,
  `\u2585\u2585\u2585    \u2585\u2585\u2585`,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586 `,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586  `,
]

const ansiE = [
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582`,
  `\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582\u2582`,
  `\u2583\u2583\u2583      `,
  `\u2584\u2584\u2584\u2584\u2584\u2584\u2584  `,
  `\u2584\u2584\u2584\u2584\u2584\u2584\u2584  `,
  `\u2585\u2585\u2585      `,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
]

/** Same 8x11 block style as other lettermarks (▂▃▄▅▆). */
const ansiV = [
  `\u2582\u2582\u2582    \u2582\u2582\u2582`,
  `\u2582\u2582\u2582    \u2582\u2582\u2582`,
  `\u2583\u2583\u2583    \u2583\u2583\u2583`,
  `\u2584\u2584\u2584    \u2584\u2584\u2584`,
  `\u2584\u2584\u2584    \u2584\u2584\u2584`,
  `\u2585\u2585\u2585    \u2585\u2585\u2585`,
  ` \u2586\u2586\u2586  \u2586\u2586\u2586 `,
  `   \u2586\u2586\u2586\u2586   `,
]

export const wordFull = ansiD.map(
  (d, i) =>
    `${d}  ${ansiE[i] ?? ""}  ${ansiV[i] ?? ""}  ${ansiE[i] ?? ""}  ${ansiC[i] ?? ""}  ${ansiO[i] ?? ""}       ${ansiC[i] ?? ""}  ${ansiO[i] ?? ""}  ${ansiD[i] ?? ""}  ${ansiE[i] ?? ""}`,
)

/** Viewport narrower than {@link LOGO_WORD_FULL_MAX_COLS}: "DEVECO" only (no "CODE"). */
export const wordDeveco = ansiD.map(
  (d, i) =>
    `${d}  ${ansiE[i] ?? ""}  ${ansiV[i] ?? ""}  ${ansiE[i] ?? ""}  ${ansiC[i] ?? ""}  ${ansiO[i] ?? ""}`,
)

function maxRowWidth(rows: readonly string[]): number {
  let m = 0
  for (const r of rows) if (r.length > m) m = r.length
  return m
}

/** Lettermark glyph rows (8x11 blocks per row). Extra entries are ignored in the banner. */
export const LOGO_ROW_CAP = 8

/** Widest row of {@link wordFull}; at or above this width the full "DEVECO CODE" mark fits without clipping. */
export const LOGO_WORD_FULL_MAX_COLS = maxRowWidth(wordFull)

/** Widest row of {@link wordDeveco}. */
export const LOGO_WORD_DEVECO_MAX_COLS = maxRowWidth(wordDeveco)

/** Horizontal scroll offset when clipping an over-wide logo: left edge fixed (show start, hide right). */
const LOGO_HEAD_CLIP_SCROLL_OFFSET = 0

export type Tone = { t: string; fg: RGBA }

export function useFullLettermark(viewportWidth: number): boolean {
  return Math.max(0, Math.floor(viewportWidth)) >= LOGO_WORD_FULL_MAX_COLS
}

export function logoRowsForWidth(width: number): readonly string[] {
  return useFullLettermark(width) ? wordFull : wordDeveco
}

export function clipLogoRawLine(raw: string, viewportWidth: number, scrollOffset: number): string {
  const vw = Math.max(0, Math.floor(viewportWidth))
  if (vw === 0) return ""
  if (raw.length <= vw) return raw
  const smax = raw.length - vw
  const off = Math.min(Math.max(0, Math.floor(scrollOffset)), smax)
  return raw.slice(off, off + vw)
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

/** Pad to width `w` with spaces on the right only (content flush left). */
export function padTonesStart(parts: Tone[], w: number, base: RGBA): Tone[] {
  const n = parts.reduce((a, p) => a + p.t.length, 0)
  if (w <= 0 || n >= w) return parts
  const tail = w - n
  return [...parts, { t: " ".repeat(tail), fg: base }]
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

export function bannerLogoScannedLineTones(
  rawLine: string,
  viewportWidth: number,
  palette: BannerLogoPalette,
): Tone[] {
  const vw = Math.max(0, Math.floor(viewportWidth))
  if (vw === 0) return []
  const clipped = rawLine.length > vw
  const slice = clipped ? clipLogoRawLine(rawLine, vw, LOGO_HEAD_CLIP_SCROLL_OFFSET) : rawLine
  const parts: Tone[] = [{ t: slice, fg: palette.logoFg }]
  const padded = clipped ? padTonesStart(parts, vw, palette.base) : padTones(parts, vw, palette.base)
  return scanline(padded, palette.stripeLine)
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

function appendAnsiFromParts(parts: Tone[], reset: string): string {
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
  return s + reset
}

/** Lettermark as stdout ANSI lines (truecolor SGR). Padded like `<Banner />`. */
export function formatBannerLogoAnsiLines(
  width: number,
  palette: BannerLogoPalette,
  options?: { scanline?: boolean },
): string[] {
  const w = Math.max(0, Math.floor(width))
  const rows = logoRowsForWidth(w).slice(0, LOGO_ROW_CAP)
  const reset = "\x1b[0m"
  const lines: string[] = []
  const withScanline = options?.scanline === true

  for (const line of rows) {
    const clipped = line.length > w
    const slice = clipped ? clipLogoRawLine(line, w, LOGO_HEAD_CLIP_SCROLL_OFFSET) : line
    const parts = clipped
      ? padTonesStart([{ t: slice, fg: palette.logoFg }], w, palette.base)
      : padTones([{ t: slice, fg: palette.logoFg }], w, palette.base)
    const tones = withScanline ? scanline(parts, palette.stripeLine) : parts
    lines.push(appendAnsiFromParts(tones, reset))
  }

  return lines
}

/** Dark-style palette when no TUI theme is available (e.g. `deveco -h` on stderr). */
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
