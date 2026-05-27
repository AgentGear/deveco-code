import { RGBA } from "@opentui/core"
import { resolveTheme, tint, type ThemeJson } from "@tui/context/theme"
import { detectCliTerminalLight } from "../util/cli-terminal-light"
import opencode from "../context/theme/opencode.json" with { type: "json" }
import { EOL } from "os"

/** 8x11 rows from Downloads/test_ansi/8x11; parsed as SGR spans in the TUI. */
const ansiC = [
  `  \u2583\u2583\u2583\u2583\u2583  `,
  `\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583`,
  `\u2583\u2583\u2583   \u2583\u2583\u2583`,
  `\u2584\u2584\u2584      `,
  `\u2584\u2584\u2584      `,
  `\u2585\u2585\u2585   \u2585\u2585\u2585`,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
  `  \u2586\u2586\u2586\u2586\u2586  `,
]

const ansiO = [
  ` \u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583 `,
  `\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583`,
  `\u2583\u2583\u2583    \u2583\u2583\u2583`,
  `\u2584\u2584\u2584    \u2584\u2584\u2584`,
  `\u2584\u2584\u2584    \u2584\u2584\u2584`,
  `\u2585\u2585\u2585    \u2585\u2585\u2585`,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
  ` \u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586 `,
]

const ansiD = [
  `\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583  `,
  `\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583 `,
  `\u2583\u2583\u2583    \u2583\u2583\u2583`,
  `\u2584\u2584\u2584    \u2584\u2584\u2584`,
  `\u2584\u2584\u2584    \u2584\u2584\u2584`,
  `\u2585\u2585\u2585    \u2585\u2585\u2585`,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586 `,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586  `,
]

const ansiE = [
  `\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583`,
  `\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583\u2583`,
  `\u2583\u2583\u2583      `,
  `\u2584\u2584\u2584\u2584\u2584\u2584\u2584  `,
  `\u2584\u2584\u2584\u2584\u2584\u2584\u2584  `,
  `\u2585\u2585\u2585      `,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
  `\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586\u2586`,
]

/** Same 8x11 block style as other lettermarks (▂▃▄▅▆). */
const ansiV = [
  `\u2583\u2583\u2583    \u2583\u2583\u2583`,
  `\u2583\u2583\u2583    \u2583\u2583\u2583`,
  `\u2583\u2583\u2583    \u2583\u2583\u2583`,
  `\u2584\u2584\u2584    \u2584\u2584\u2584`,
  `\u2584\u2584\u2584    \u2584\u2584\u2584`,
  `\u2585\u2585\u2585    \u2585\u2585\u2585`,
  ` \u2586\u2586\u2586  \u2586\u2586\u2586 `,
  `   \u2586\u2586\u2586\u2586   `,
]

/** 5 rows × 4 columns per letter (▂▃▄▅▆ block heights). */
const ansiSmallC = [
  ` \u2583\u2583\u2583 `,
  `\u2583   \u2583`,
  `\u2584    `,
  `\u2585   \u2585`,
  ` \u2586\u2586\u2586 `,
];

const ansiSmallO = [
  ` \u2583\u2583\u2583 `,
  `\u2583   \u2583`,
  `\u2584   \u2584`,
  `\u2585   \u2585`,
  ` \u2586\u2586\u2586 `,
];

const ansiSmallD = [
  `\u2583\u2583\u2583\u2583 `,
  `\u2583   \u2583`,
  `\u2584   \u2584`,
  `\u2585   \u2585`,
  `\u2586\u2586\u2586\u2586 `,
];

const ansiSmallE = [
  `\u2583\u2583\u2583\u2583`,
  `\u2583   `,
  `\u2584\u2584\u2584\u2584`,
  `\u2585   `,
  `\u2586\u2586\u2586\u2586`,
];

const ansiSmallV = [
  `\u2583   \u2583`,
  `\u2583   \u2583`,
  `\u2584   \u2584`,
  `\u2585   \u2585`,
  ` \u2586\u2586\u2586 `,
];

export const wordFull = ansiD.map(
  (d, i) =>
    `${d}  ${ansiE[i] ?? ""}  ${ansiV[i] ?? ""}  ${ansiE[i] ?? ""}  ${ansiC[i] ?? ""}  ${ansiO[i] ?? ""}       ${ansiC[i] ?? ""}  ${ansiO[i] ?? ""}  ${ansiD[i] ?? ""}  ${ansiE[i] ?? ""}`,
)

/** Viewport narrower than {@link LOGO_WORD_FULL_MAX_COLS}: "DEVECO" only (no "CODE"). */
export const wordDeveco = ansiD.map(
  (d, i) =>
    `${d}  ${ansiE[i] ?? ""}  ${ansiV[i] ?? ""}  ${ansiE[i] ?? ""}  ${ansiC[i] ?? ""}  ${ansiO[i] ?? ""}`,
)

/** 5×4 lettermarks — "DEVECO" only (no "CODE"). */
export const wordDevecoSmall = ansiSmallD.map(
  (d, i) =>
    `${d}  ${ansiSmallE[i] ?? ''}  ${ansiSmallV[i] ?? ''}  ${ansiSmallE[i] ?? ''}  ${ansiSmallC[i] ?? ''}  ${ansiSmallO[i] ?? ''}`,
);

export const wordFullSmall = ansiSmallD.map(
  (d, i) =>
    `${d} ${ansiSmallE[i] ?? ''} ${ansiSmallV[i] ?? ''} ${ansiSmallE[i] ?? ''} ${ansiSmallC[i] ?? ''} ${ansiSmallO[i] ?? ''}   ${ansiSmallC[i] ?? ''} ${ansiSmallO[i] ?? ''} ${ansiSmallD[i] ?? ''} ${ansiSmallE[i] ?? ''}`,
);

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

/** Light banner scanline: #000000 at 10% opacity over the panel background. */
export function stripeLineForLight(background: RGBA): RGBA {
  return tint(background, RGBA.fromInts(0, 0, 0), 0.1)
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
  theme: { text: RGBA; textMuted: RGBA; border: RGBA; background: RGBA },
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
    stripeLine: stripeLineForLight(theme.background),
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
  options?: {
    scanline?: boolean;
    /** With {@link scanline}, stripe spaces inside the logo only (not width padding). */
    scanlineWithinLogo?: boolean;
    rows?: readonly string[];
    align?: 'start' | 'center';
  },
): string[] {
  const w = Math.max(0, Math.floor(width));
  const source = options?.rows ?? logoRowsForWidth(w);
  const rows = source.slice(0, options?.rows ? source.length : LOGO_ROW_CAP);
  const reset = '\x1b[0m';
  const lines: string[] = [];
  const withScanline = options?.scanline === true;
  const scanLogoOnly = withScanline && options?.scanlineWithinLogo === true;
  const left = options?.align === 'start';

  for (const line of rows) {
    const clipped = line.length > w;
    const slice = clipped ? clipLogoRawLine(line, w, LOGO_HEAD_CLIP_SCROLL_OFFSET) : line;
    const content = [{ t: slice, fg: palette.logoFg }];
    let tones: Tone[];
    if (scanLogoOnly) {
      tones = scanline(content, palette.stripeLine);
    } else if (left && !withScanline && !clipped) {
      tones = content;
    } else {
      const parts =
        clipped || left
          ? padTonesStart(content, w, palette.base)
          : padTones(content, w, palette.base);
      tones = withScanline ? scanline(parts, palette.stripeLine) : parts;
    }
    lines.push(appendAnsiFromParts(tones, reset));
  }

  return lines;
}

/** CLI banner palette: dark terminal → white logo; light terminal → opencode theme.text. */
export function cliHelpBannerLogoPalette(): BannerLogoPalette {
  const isLight = detectCliTerminalLight()
  const theme = resolveTheme(opencode as ThemeJson, isLight ? "light" : "dark")
  return bannerLogoPalette(isLight, theme)
}

/** Banner lettermark for CLI output (help, uninstall, upgrade). Adapts to terminal light/dark. */
export function formatCliHelpBannerLogoBlock(columns: number | undefined): string {
  const w = typeof columns === 'number' && columns > 0 ? columns : 80;
  return formatBannerLogoAnsiLines(w, cliHelpBannerLogoPalette(), {
    rows: wordFullSmall,
    align: 'start',
  }).join(EOL);
}
