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

/** Scan-cover / thick-top glyphs: thick ▆, thin ▃ (上粗下细). */
export const LOGO_BLOCK_THICK = "\u2586"
export const LOGO_BLOCK_THIN = "\u2583"

/** Map normal lettermark blocks (▃ top, ▆ bottom) → thick-top (▆ top, ▃ bottom). */
const BLOCK_HEIGHT_INVERT: Record<string, string> = {
  "\u2582": LOGO_BLOCK_THICK,
  "\u2583": LOGO_BLOCK_THICK,
  "\u2584": LOGO_BLOCK_THICK,
  "\u2585": LOGO_BLOCK_THIN,
  "\u2586": LOGO_BLOCK_THIN,
}

/** Same letter layout as {@link line}; block heights inverted (▆ top, ▃ bottom). */
export function thickTopLogoLine(line: string): string {
  let out = ""
  for (const ch of line) out += BLOCK_HEIGHT_INVERT[ch] ?? ch
  return out
}

/** Thick-top variant of each lettermark row (letter shapes stay upright). */
export function thickTopLogoRows(rows: readonly string[]): readonly string[] {
  return rows.map(thickTopLogoLine)
}

/**
 * scanCover white layer: per-row block height (上粗下细).
 * Row 1–2 ▆, 3 ▅, 4–5 ▄, 6–8 ▃.
 */
export const SCAN_COVER_ROW_BLOCKS: readonly string[] = [
  "\u2586",
  "\u2586",
  "\u2585",
  "\u2584",
  "\u2584",
  "\u2583",
  "\u2583",
  "\u2583",
]

function isLogoBlockChar(ch: string): boolean {
  return ch >= "\u2582" && ch <= "\u2586"
}

/** Replace glyph blocks on {@link rowIndex} with {@link SCAN_COVER_ROW_BLOCKS} height; keep spaces. */
export function scanCoverLogoLine(line: string, rowIndex: number): string {
  const block = SCAN_COVER_ROW_BLOCKS[Math.min(Math.max(0, rowIndex), SCAN_COVER_ROW_BLOCKS.length - 1)] ?? LOGO_BLOCK_THIN
  let out = ""
  for (const ch of line) out += isLogoBlockChar(ch) ? block : ch
  return out
}

export function scanCoverLogoRows(rows: readonly string[]): readonly string[] {
  return rows.map((line, i) => scanCoverLogoLine(line, i))
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

/** Thin scan stripe between glyphs (coverFade gaps, 2s+ intro, final logo). */
export const LOGO_SCANLINE_CHAR = "─"

/** {@link LOGO_SCANLINE_CHAR} scanlines in lettermark gaps. */
export function scanline(parts: Tone[], fg: RGBA): Tone[] {
  return scanlineWithSpaceChar(parts, fg, LOGO_SCANLINE_CHAR)
}

/**
 * Scanlines with a custom space fill. {@link scanCoverSpaceBlock} uses ▆▅▄▃ per row (2–3s cover);
 * {@link LOGO_SCANLINE_CHAR} is the thin variant everywhere else.
 */
export function scanlineWithSpaceChar(parts: Tone[], stripeLine: RGBA, spaceChar: string): Tone[] {
  const out: Tone[] = []
  let buf = ""
  let cur = stripeLine

  const flush = () => {
    if (!buf) return
    out.push({ t: buf, fg: cur })
    buf = ""
  }

  for (const p of parts) {
    for (const ch of p.t) {
      const isSpace = ch === " "
      const nextFg = isSpace ? stripeLine : p.fg
      const nextCh = isSpace ? spaceChar : ch
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

export function scanCoverSpaceBlock(rowIndex: number): string {
  return SCAN_COVER_ROW_BLOCKS[Math.min(Math.max(0, rowIndex), SCAN_COVER_ROW_BLOCKS.length - 1)] ?? LOGO_BLOCK_THIN
}

export type BannerLogoPalette = {
  logoFg: RGBA
  stripeLine: RGBA
  base: RGBA
}

/** Intro block-scan stripe; same RGB as {@link BannerLogoPalette.logoFg}, {@link opacity} is FG alpha. */
export function logoIntroStripeColor(palette: BannerLogoPalette, opacity: number): RGBA {
  const o = Math.max(0, Math.min(1, opacity))
  return RGBA.fromInts(
    Math.round(palette.logoFg.r * 255),
    Math.round(palette.logoFg.g * 255),
    Math.round(palette.logoFg.b * 255),
    Math.round(o * 255),
  )
}

/** coverFade: full-width ▆▅▄▃ scan row only; entire logo gone, opacity 100%→10%. */
function bannerLogoCoverFadeRowTones(rowIndex: number, viewportWidth: number, stripe: RGBA): Tone[] {
  const vw = Math.max(0, Math.floor(viewportWidth))
  if (vw === 0) return []
  const spaceBlock = scanCoverSpaceBlock(rowIndex)
  return [{ t: spaceBlock.repeat(vw), fg: stripe }]
}

/** Full-width blank row (logo hidden; TUI may ignore FG alpha on block glyphs). */
function bannerLogoBlankRowTones(viewportWidth: number, palette: BannerLogoPalette): Tone[] {
  const vw = Math.max(0, Math.floor(viewportWidth))
  if (vw === 0) return []
  return [{ t: " ".repeat(vw), fg: palette.base }]
}

/** Hide glyph blocks (gaps only) for scanline-only intro. */
function logoLineMaskGlyphsToSpaces(line: string): string {
  let out = ""
  for (const ch of line) out += isLogoBlockChar(ch) ? " " : ch
  return out
}

/** scanlineFadeIn (2–3s): thin {@link LOGO_SCANLINE_CHAR} in lettermark gaps; no glyphs. */
function bannerLogoScanlineGapRowTones(
  normalLine: string,
  viewportWidth: number,
  palette: BannerLogoPalette,
  stripe: RGBA,
): Tone[] {
  const vw = Math.max(0, Math.floor(viewportWidth))
  if (vw === 0) return []
  const clipped = normalLine.length > vw
  const slice = clipped ? clipLogoRawLine(normalLine, vw, LOGO_HEAD_CLIP_SCROLL_OFFSET) : normalLine
  const gapSlice = logoLineMaskGlyphsToSpaces(slice)
  const parts: Tone[] = [{ t: gapSlice, fg: palette.base }]
  const padded = clipped ? padTonesStart(parts, vw, palette.base) : padTones(parts, vw, palette.base)
  return scanline(padded, stripe)
}

/** Lettermark row without thin {@link LOGO_SCANLINE_CHAR} gaps (scanCover unrevealed rows). */
function bannerLogoRowTonesNoScanlines(
  rawLine: string,
  viewportWidth: number,
  palette: BannerLogoPalette,
  logoBlend: number,
): Tone[] {
  if (logoBlend <= 0) return bannerLogoBlankRowTones(viewportWidth, palette)
  const vw = Math.max(0, Math.floor(viewportWidth))
  if (vw === 0) return []
  const clipped = rawLine.length > vw
  const slice = clipped ? clipLogoRawLine(rawLine, vw, LOGO_HEAD_CLIP_SCROLL_OFFSET) : rawLine
  const parts: Tone[] = [{ t: slice, fg: logoIntroLogoFg(palette, logoBlend) }]
  return clipped ? padTonesStart(parts, vw, palette.base) : padTones(parts, vw, palette.base)
}

/** scanCover row: {@link SCAN_COVER_ROW_BLOCKS} glyphs + matching block “scan” fill (not thin ─). */
function bannerLogoThickTopWhiteCoverTones(
  coverLine: string,
  rowIndex: number,
  viewportWidth: number,
  palette: BannerLogoPalette,
  stripe: RGBA,
  glyphBlend: number,
): Tone[] {
  const vw = Math.max(0, Math.floor(viewportWidth))
  if (vw === 0) return []
  const clipped = coverLine.length > vw
  const slice = clipped ? clipLogoRawLine(coverLine, vw, LOGO_HEAD_CLIP_SCROLL_OFFSET) : coverLine
  const g = Math.max(0, Math.min(1, glyphBlend))
  const glyphFg = RGBA.fromInts(255, 255, 255, Math.round(stripe.a * 255 * g))
  const parts: Tone[] = [{ t: slice, fg: glyphFg }]
  const padded = clipped ? padTonesStart(parts, vw, palette.base) : padTones(parts, vw, palette.base)
  return scanlineWithSpaceChar(padded, stripe, scanCoverSpaceBlock(rowIndex))
}

/** scanCover / logoRowReveal beat (ms). */
export const LOGO_PHASE_MS = 800
/** Pause after scanCover / logoRowReveal complete (ms). */
export const LOGO_PHASE_PAUSE_MS = 500
export const LOGO_SCAN_FADE_END_OPACITY = 0.1
export const LOGO_SHIFT_RIGHT_COLS = 2
export const LOGO_SHIFT_LEFT_COLS = -2
/** Columns cleared per letter during shift (vacate trail width). */
export const LOGO_SHIFT_VACATE_COLS = 2
/** shiftRight / shiftLeft beat (ms). */
export const LOGO_SHIFT_BEAT_MS = 500
/** shiftHold / shiftLeftHold pulse (ms). */
export const LOGO_SHIFT_HOLD_MS = 100
/** Recenter after a shift hold (ms). */
export const LOGO_SHIFT_CENTER_MS = 300

/** Total intro length (ms): ~4.4s. */
export const LOGO_INTRO_DURATION_MS =
  LOGO_PHASE_MS * 2 +
  LOGO_PHASE_PAUSE_MS * 2 +
  LOGO_SHIFT_BEAT_MS * 2 +
  LOGO_SHIFT_HOLD_MS * 2 +
  LOGO_SHIFT_CENTER_MS * 2

export type LogoIntroPhase =
  | "scanCover"
  | "logoRowReveal"
  | "shiftRight"
  | "shiftHold"
  | "shiftCenter"
  | "shiftLeft"
  | "shiftLeftHold"

export type LogoIntroFrame =
  | { kind: "done" }
  | {
      kind: "animating"
      phase: LogoIntroPhase
      /** Inclusive row index for row-by-row phases; -1 = none revealed yet. */
      revealedRow: number
      /** Block-scan / scanline FG alpha. */
      stripeOpacity: number
      /** Logo FG alpha (0–1). */
      logoBlend: number
      /** Horizontal shift in columns (0 = centered). */
      shiftCols: number
      /** Thick-top blocks vs normal (thin-top) lettermark. */
      thickTop: boolean
      /** 0 = intro logo-hued stripe; 1 = {@link BannerLogoPalette.stripeLine}. */
      stripeThemeBlend: number
    }

function phaseProgressInWindow(elapsedMs: number, startMs: number, durationMs: number): number {
  return Math.max(0, Math.min(1, (elapsedMs - startMs) / durationMs))
}

function revealedRowForProgress(p: number, rowCount: number): number {
  const rows = Math.max(1, Math.floor(rowCount))
  if (p <= 0) return -1
  return Math.min(rows - 1, Math.ceil(p * rows) - 1)
}

/** Compute intro frame from elapsed time since animation start. */
export function logoIntroFrameAt(elapsedMs: number, rowCount: number): LogoIntroFrame {
  if (elapsedMs >= LOGO_INTRO_DURATION_MS) return { kind: "done" }

  const rows = Math.max(1, Math.floor(rowCount))
  const lastRow = rows - 1
  const postReveal = {
    revealedRow: lastRow,
    stripeOpacity: LOGO_SCAN_FADE_END_OPACITY,
    logoBlend: 1,
    thickTop: false,
    stripeThemeBlend: 1,
  }

  const tScanEnd = LOGO_PHASE_MS
  const tScanPauseEnd = tScanEnd + LOGO_PHASE_PAUSE_MS
  const tRevealEnd = tScanPauseEnd + LOGO_PHASE_MS
  const tRevealPauseEnd = tRevealEnd + LOGO_PHASE_PAUSE_MS

  if (elapsedMs < tScanEnd) {
    const p = phaseProgressInWindow(elapsedMs, 0, LOGO_PHASE_MS)
    return {
      kind: "animating",
      phase: "scanCover",
      revealedRow: revealedRowForProgress(p, rows),
      stripeOpacity: 1,
      logoBlend: 0,
      shiftCols: 0,
      thickTop: true,
      stripeThemeBlend: 0,
    }
  }

  if (elapsedMs < tScanPauseEnd) {
    return {
      kind: "animating",
      phase: "scanCover",
      revealedRow: lastRow,
      stripeOpacity: 1,
      logoBlend: 0,
      shiftCols: 0,
      thickTop: true,
      stripeThemeBlend: 0,
    }
  }

  if (elapsedMs < tRevealEnd) {
    const p = phaseProgressInWindow(elapsedMs, tScanPauseEnd, LOGO_PHASE_MS)
    return {
      kind: "animating",
      phase: "logoRowReveal",
      revealedRow: revealedRowForProgress(p, rows),
      stripeOpacity: LOGO_SCAN_FADE_END_OPACITY,
      logoBlend: 1,
      shiftCols: 0,
      thickTop: false,
      stripeThemeBlend: 1,
    }
  }

  if (elapsedMs < tRevealPauseEnd) {
    return {
      kind: "animating",
      phase: "logoRowReveal",
      ...postReveal,
      shiftCols: 0,
    }
  }

  const tShiftREnd = tRevealPauseEnd + LOGO_SHIFT_BEAT_MS
  if (elapsedMs < tShiftREnd) {
    return {
      kind: "animating",
      phase: "shiftRight",
      ...postReveal,
      shiftCols: LOGO_SHIFT_RIGHT_COLS,
    }
  }

  const tShiftRHoldEnd = tShiftREnd + LOGO_SHIFT_HOLD_MS
  if (elapsedMs < tShiftRHoldEnd) {
    return {
      kind: "animating",
      phase: "shiftHold",
      ...postReveal,
      shiftCols: LOGO_SHIFT_RIGHT_COLS,
    }
  }

  const tCenter1End = tShiftRHoldEnd + LOGO_SHIFT_CENTER_MS
  if (elapsedMs < tCenter1End) {
    return { kind: "animating", phase: "shiftCenter", ...postReveal, shiftCols: 0 }
  }

  const tShiftLEnd = tCenter1End + LOGO_SHIFT_BEAT_MS
  if (elapsedMs < tShiftLEnd) {
    return {
      kind: "animating",
      phase: "shiftLeft",
      ...postReveal,
      shiftCols: LOGO_SHIFT_LEFT_COLS,
    }
  }

  const tShiftLHoldEnd = tShiftLEnd + LOGO_SHIFT_HOLD_MS
  if (elapsedMs < tShiftLHoldEnd) {
    return {
      kind: "animating",
      phase: "shiftLeftHold",
      ...postReveal,
      shiftCols: LOGO_SHIFT_LEFT_COLS,
    }
  }

  return { kind: "animating", phase: "shiftCenter", ...postReveal, shiftCols: 0 }
}

function rgbaKey(c: RGBA): string {
  return `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`
}

function contentLeftFromPadded(padded: Tone[], clipped: boolean, base: RGBA): number {
  if (clipped) return 0
  const first = padded[0]
  if (!first || rgbaKey(first.fg) !== rgbaKey(base)) return 0
  return first.t.length
}

function countLeadingSpaces(text: string): number {
  let lead = 0
  for (const ch of text) {
    if (ch === " ") lead += 1
    else break
  }
  return lead
}

function glyphLeftColumn(contentLeft: number, slice: string): number {
  return contentLeft + countLeadingSpaces(slice)
}

const LETTERMARK_SEP = "  "
const LETTERMARK_DEVECO_CODE_SEP = "       "

function letterSegmentsForRow(rowIndex: number, fullMark: boolean): readonly string[] {
  const i = rowIndex
  if (fullMark) {
    return [
      ansiD[i] ?? "",
      ansiE[i] ?? "",
      ansiV[i] ?? "",
      ansiE[i] ?? "",
      ansiC[i] ?? "",
      ansiO[i] ?? "",
      ansiC[i] ?? "",
      ansiO[i] ?? "",
      ansiD[i] ?? "",
      ansiE[i] ?? "",
    ]
  }
  return [ansiD[i] ?? "", ansiE[i] ?? "", ansiV[i] ?? "", ansiE[i] ?? "", ansiC[i] ?? "", ansiO[i] ?? ""]
}

function letterSeparatorsForRow(fullMark: boolean): readonly string[] {
  if (fullMark) {
    return [
      LETTERMARK_SEP,
      LETTERMARK_SEP,
      LETTERMARK_SEP,
      LETTERMARK_SEP,
      LETTERMARK_SEP,
      LETTERMARK_DEVECO_CODE_SEP,
      LETTERMARK_SEP,
      LETTERMARK_SEP,
      LETTERMARK_SEP,
    ]
  }
  return [LETTERMARK_SEP, LETTERMARK_SEP, LETTERMARK_SEP, LETTERMARK_SEP, LETTERMARK_SEP]
}

function letterGlyphStartsInSlice(
  segments: readonly string[],
  separators: readonly string[],
  slice: string,
  clipOffset: number,
): number[] {
  const starts: number[] = []
  let off = 0
  for (let s = 0; s < segments.length; s++) {
    const absStart = off + countLeadingSpaces(segments[s] ?? "")
    const inSlice = absStart - clipOffset
    if (inSlice >= 0 && inSlice < slice.length && slice[inSlice] !== " ") starts.push(inSlice)
    off += (segments[s] ?? "").length
    if (s < segments.length - 1) off += (separators[s] ?? LETTERMARK_SEP).length
  }
  return starts
}

function letterVacateColumns(
  rowIndex: number,
  fullMark: boolean,
  slice: string,
  contentLeft: number,
  clipOffset: number,
): ReadonlySet<number> {
  const segments = letterSegmentsForRow(rowIndex, fullMark)
  const separators = letterSeparatorsForRow(fullMark)
  const cols = new Set<number>()
  const w = Math.max(1, Math.floor(LOGO_SHIFT_VACATE_COLS))
  for (const s of letterGlyphStartsInSlice(segments, separators, slice, clipOffset)) {
    for (let d = 0; d < w; d++) cols.add(contentLeft + s + d)
  }
  return cols
}

/** Vacate {@link LOGO_SHIFT_VACATE_COLS} columns to the right of each letter after shift-left. */
function letterVacateColumnsRight(
  rowIndex: number,
  fullMark: boolean,
  slice: string,
  contentLeft: number,
  clipOffset: number,
  shiftLeftCols: number,
): ReadonlySet<number> {
  const segments = letterSegmentsForRow(rowIndex, fullMark)
  const separators = letterSeparatorsForRow(fullMark)
  const cols = new Set<number>()
  const w = Math.max(1, Math.floor(LOGO_SHIFT_VACATE_COLS))
  const shift = Math.max(0, Math.round(Math.abs(shiftLeftCols)))

  let off = 0
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si] ?? ""
    let lastBlock = -1
    for (let i = 0; i < seg.length; i++) {
      if (isLogoBlockChar(seg[i]!)) lastBlock = off + i
    }
    const absStart = off + countLeadingSpaces(seg)
    if (lastBlock >= absStart) {
      const endInSlice = lastBlock - clipOffset
      if (endInSlice >= 0 && endInSlice < slice.length) {
        for (let d = 1; d <= w; d++) {
          const col = contentLeft + endInSlice - shift + d
          if (col >= 0) cols.add(col)
        }
      }
    }
    off += seg.length
    if (si < segments.length - 1) off += (separators[si] ?? LETTERMARK_SEP).length
  }
  return cols
}

function shiftCharsVacateLeft(
  chars: { ch: string; fg: RGBA }[],
  shiftStart: number,
  shiftCols: number,
  base: RGBA,
): { ch: string; fg: RGBA }[] {
  const shift = Math.max(0, Math.round(shiftCols))
  if (shift === 0) return chars

  const out: { ch: string; fg: RGBA }[] = []
  for (let i = 0; i < chars.length; i++) {
    if (i < shiftStart) {
      out.push(chars[i] ?? { ch: " ", fg: base })
      continue
    }
    if (i < shiftStart + shift) {
      out.push({ ch: " ", fg: base })
      continue
    }
    out.push(chars[i - shift] ?? { ch: " ", fg: base })
  }
  return out
}

/** Shift lettermark left from {@link shiftStart}; left padding before that stays put. */
function shiftCharsShiftLeft(
  chars: { ch: string; fg: RGBA }[],
  shiftStart: number,
  shift: number,
  base: RGBA,
): { ch: string; fg: RGBA }[] {
  const left = Math.max(0, Math.round(shift))
  if (left === 0) return chars

  const out: { ch: string; fg: RGBA }[] = []
  for (let i = 0; i < chars.length; i++) {
    if (i < shiftStart - left) {
      out.push(chars[i] ?? { ch: " ", fg: base })
      continue
    }
    const src = i + left
    if (src < chars.length) {
      out.push(chars[src] ?? { ch: " ", fg: base })
    } else {
      out.push({ ch: " ", fg: base })
    }
  }
  return out
}

function scanlineFromChars(
  chars: { ch: string; fg: RGBA }[],
  stripeLine: RGBA,
  blankFg: RGBA,
  vacateColumns: ReadonlySet<number>,
): Tone[] {
  const out: Tone[] = []
  let buf = ""
  let cur = stripeLine

  const flush = () => {
    if (!buf) return
    out.push({ t: buf, fg: cur })
    buf = ""
  }

  for (let col = 0; col < chars.length; col++) {
    const p = chars[col] ?? { ch: " ", fg: blankFg }
    const vacated = vacateColumns.has(col)
    const isSpace = p.ch === " "
    const nextFg = vacated ? blankFg : isSpace ? stripeLine : p.fg
    const nextCh = vacated ? " " : isSpace ? "─" : p.ch
    if (nextFg !== cur) {
      flush()
      cur = nextFg
    }
    buf += nextCh
  }
  flush()
  return out
}

export function logoIntroLogoFg(palette: BannerLogoPalette, logoBlend: number): RGBA {
  const o = Math.max(0, Math.min(1, logoBlend))
  return RGBA.fromInts(
    Math.round(palette.logoFg.r * 255),
    Math.round(palette.logoFg.g * 255),
    Math.round(palette.logoFg.b * 255),
    Math.round(o * 255),
  )
}

function introStripeColor(palette: BannerLogoPalette, frame: Extract<LogoIntroFrame, { kind: "animating" }>): RGBA {
  const intro = logoIntroStripeColor(palette, frame.stripeOpacity)
  const t = Math.max(0, Math.min(1, frame.stripeThemeBlend))
  if (t <= 0) return intro
  if (t >= 1) return palette.stripeLine
  return RGBA.fromInts(
    Math.round(intro.r * 255 + (palette.stripeLine.r * 255 - intro.r * 255) * t),
    Math.round(intro.g * 255 + (palette.stripeLine.g * 255 - intro.g * 255) * t),
    Math.round(intro.b * 255 + (palette.stripeLine.b * 255 - intro.b * 255) * t),
    Math.round(intro.a * 255 + (palette.stripeLine.a * 255 - intro.a * 255) * t),
  )
}

/**
 * Home intro: block scan → pause → row reveal → pause → shift R/hold/center/L/hold/center → done.
 */
export function bannerLogoScannedLineTonesWithIntro(
  normalLine: string,
  _thickTopLine: string,
  rowIndex: number,
  frame: LogoIntroFrame,
  viewportWidth: number,
  palette: BannerLogoPalette,
): Tone[] {
  if (frame.kind === "done") return bannerLogoScannedLineTones(normalLine, viewportWidth, palette)

  const stripe = introStripeColor(palette, frame)

  if (frame.phase === "scanCover") {
    if (rowIndex > frame.revealedRow) return bannerLogoBlankRowTones(viewportWidth, palette)
    return bannerLogoCoverFadeRowTones(rowIndex, viewportWidth, stripe)
  }

  if (frame.phase === "logoRowReveal") {
    if (rowIndex > frame.revealedRow) {
      return bannerLogoCoverFadeRowTones(rowIndex, viewportWidth, logoIntroStripeColor(palette, 1))
    }
    return bannerLogoScannedLineTones(normalLine, viewportWidth, palette, stripe, 0, frame.logoBlend, rowIndex)
  }

  return bannerLogoScannedLineTones(
    normalLine,
    viewportWidth,
    palette,
    stripe,
    frame.shiftCols,
    frame.logoBlend,
    rowIndex,
  )
}

export function bannerLogoScannedLineTones(
  rawLine: string,
  viewportWidth: number,
  palette: BannerLogoPalette,
  stripeLine: RGBA = palette.stripeLine,
  shiftCols = 0,
  logoBlend = 1,
  rowIndex = 0,
): Tone[] {
  const vw = Math.max(0, Math.floor(viewportWidth))
  if (vw === 0) return []
  const clipped = rawLine.length > vw
  const clipOffset = clipped ? LOGO_HEAD_CLIP_SCROLL_OFFSET : 0
  const slice = clipped ? clipLogoRawLine(rawLine, vw, clipOffset) : rawLine
  const parts: Tone[] = [{ t: slice, fg: logoIntroLogoFg(palette, logoBlend) }]
  const padded = clipped ? padTonesStart(parts, vw, palette.base) : padTones(parts, vw, palette.base)
  const contentLeft = contentLeftFromPadded(padded, clipped, palette.base)
  const shiftStart = glyphLeftColumn(contentLeft, slice)
  const shift = Math.round(shiftCols)

  let chars: { ch: string; fg: RGBA }[] = []
  for (const p of padded) for (const ch of p.t) chars.push({ ch, fg: p.fg })
  while (chars.length < vw) chars.push({ ch: " ", fg: palette.base })
  chars = chars.slice(0, vw)

  if (shift > 0) {
    chars = shiftCharsVacateLeft(chars, shiftStart, shift, palette.base)
    const vacateColumns = letterVacateColumns(rowIndex, useFullLettermark(vw), slice, contentLeft, clipOffset)
    return scanlineFromChars(chars, stripeLine, palette.base, vacateColumns)
  }

  if (shift < 0) {
    const left = Math.abs(shift)
    chars = shiftCharsShiftLeft(chars, shiftStart, left, palette.base)
    const vacateColumns = letterVacateColumnsRight(
      rowIndex,
      useFullLettermark(vw),
      slice,
      contentLeft,
      clipOffset,
      shiftCols,
    )
    return scanlineFromChars(chars, stripeLine, palette.base, vacateColumns)
  }

  return scanline(padded, stripeLine)
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
