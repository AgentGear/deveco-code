import { MouseButton, type MouseEvent, RGBA } from "@opentui/core"
import { tint } from "@tui/context/theme"
import type { Theme } from "@tui/theme"
import {
  isLogoBlockChar,
  logoRowsForWidth,
  type BannerLogoPalette,
  type Tone,
} from "./banner-logo"

// --- Constants (ported from upstream logo.tsx) ---

const GAP = 1
const WIDTH = 0.76
const GAIN = 2.3
const FLASH = 2.15
const TRAIL = 0.28
const SWELL = 0.24
const WIDE = 1.85
const DRIFT = 1.45
const EXPAND = 1.62
const LIFE = 1020
const CHARGE = 3000
const HOLD = 90
const SINK = 40
const ARC = 2.2
const FORK = 1.2
const DIM = 1.04
const KICK = 0.86
const LAG = 60
const SUCK = 0.34
const SHIMMER_IN = 60
const SHIMMER_OUT = 2.8
const TRACE = 0.033
const TAIL = 1.8
const TRACE_IN = 200
const GLOW_OUT = 1600

// --- Types ---

export type Ring = { x: number; y: number; at: number; force: number; kick: number }
export type Hold = { x: number; y: number; at: number; glyph: number | undefined }
export type Release = {
  x: number
  y: number
  at: number
  glyph: number | undefined
  level: number
  rise: number
}
export type Glow = { glyph: number; at: number; force: number }
export type Frame = {
  t: number
  list: Ring[]
  hold: Hold | undefined
  release: Release | undefined
  glow: Glow | undefined
  spark: number
}

type Trace = { glyph: number; i: number; l: number }

type GlyphMap = {
  glyph: Map<string, number>
  trace: Map<string, Trace>
  center: Map<number, { x: number; y: number }>
  rows: readonly string[]
  width: number
  contentLeft: number
}

const NEAR = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const

// --- Math helpers ---

function clamp(n: number) {
  return Math.max(0, Math.min(1, n))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp(t)
}

function ease(t: number) {
  const p = clamp(t)
  return p * p * (3 - 2 * p)
}

function push(t: number) {
  const p = clamp(t)
  return ease(p * p)
}

function ramp(t: number, start: number, end: number) {
  if (end <= start) return ease(t >= end ? 1 : 0)
  return ease((t - start) / (end - start))
}

function noise(x: number, y: number, t: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + t * 0.043) * 43758.5453
  return n - Math.floor(n)
}

function key(x: number, y: number) {
  return `${x},${y}`
}

// --- Glyph mapping ---

function route(list: Array<{ x: number; y: number }>) {
  const left = new Map(list.map((item) => [key(item.x, item.y), item]))
  const path: Array<{ x: number; y: number }> = []
  let cur = [...left.values()].sort((a, b) => a.y - b.y || a.x - b.x)[0]
  let dir = { x: 1, y: 0 }

  while (cur) {
    path.push(cur)
    left.delete(key(cur.x, cur.y))
    if (!left.size) return path

    const next = NEAR.map(([dx, dy]) => left.get(key(cur.x + dx, cur.y + dy)))
      .filter((item): item is { x: number; y: number } => !!item)
      .sort((a, b) => {
        const ax = a.x - cur.x
        const ay = a.y - cur.y
        const bx = b.x - cur.x
        const by = b.y - cur.y
        const adot = ax * dir.x + ay * dir.y
        const bdot = bx * dir.x + by * dir.y
        if (adot !== bdot) return bdot - adot
        return Math.abs(ax) + Math.abs(ay) - (Math.abs(bx) + Math.abs(by))
      })[0]

    if (!next) {
      cur = [...left.values()].sort((a, b) => {
        const da = (a.x - cur.x) ** 2 + (a.y - cur.y) ** 2
        const db = (b.x - cur.x) ** 2 + (b.y - cur.y) ** 2
        return da - db
      })[0]
      dir = { x: 1, y: 0 }
      continue
    }

    dir = { x: next.x - cur.x, y: next.y - cur.y }
    cur = next
  }

  return path
}

export function buildGlyphMap(viewportWidth: number): GlyphMap {
  const rows = logoRowsForWidth(viewportWidth).slice(0, 8)
  const rawWidth = rows[0]?.length ?? 0
  // padTones centers content: leftPad = floor((viewportWidth - rawWidth) / 2)
  const contentLeft = rawWidth < viewportWidth ? Math.floor((viewportWidth - rawWidth) / 2) : 0
  const cells: Array<{ x: number; y: number }> = []

  for (let y = 0; y < rows.length; y++) {
    const line = rows[y] ?? ""
    for (let x = 0; x < line.length; x++) {
      if (isLogoBlockChar(line[x]!)) cells.push({ x: x + contentLeft, y })
    }
  }

  const all = new Map(cells.map((item) => [key(item.x, item.y), item]))
  const seen = new Set<string>()
  const glyph = new Map<string, number>()
  const trace = new Map<string, Trace>()
  const center = new Map<number, { x: number; y: number }>()
  let id = 0

  for (const item of cells) {
    const start = key(item.x, item.y)
    if (seen.has(start)) continue
    const stack = [item]
    const part: Array<{ x: number; y: number }> = []
    seen.add(start)

    while (stack.length) {
      const cur = stack.pop()!
      part.push(cur)
      glyph.set(key(cur.x, cur.y), id)
      for (const [dx, dy] of NEAR) {
        const next = all.get(key(cur.x + dx, cur.y + dy))
        if (!next) continue
        const mark = key(next.x, next.y)
        if (seen.has(mark)) continue
        seen.add(mark)
        stack.push(next)
      }
    }

    const path = route(part)
    path.forEach((cell, i) => trace.set(key(cell.x, cell.y), { glyph: id, i, l: path.length }))
    center.set(id, {
      x: part.reduce((sum, item) => sum + item.x, 0) / part.length + 0.5,
      y: (part.reduce((sum, item) => sum + item.y, 0) / part.length) * 2 + 1,
    })
    id++
  }

  return { glyph, trace, center, rows, width: viewportWidth, contentLeft }
}

// --- Physics functions (ported from upstream) ---

function shimmer(x: number, y: number, frame: Frame) {
  return frame.list.reduce((best, item) => {
    const age = frame.t - item.at
    if (age < SHIMMER_IN || age > LIFE) return best
    const dx = x + 0.5 - item.x
    const dy = y * 2 + 1 - item.y
    const dist = Math.hypot(dx, dy)
    const p = age / LIFE
    const span = Math.hypot(frame.list.length > 0 ? 100 : 50, 8 * 2) * 0.94
    const r = span * (1 - (1 - p) ** EXPAND)
    const lag = r - dist
    if (lag < 0.18 || lag > SHIMMER_OUT) return best
    const band = Math.exp(-(((lag - 1.05) / 0.68) ** 2))
    const wobble = 0.5 + 0.5 * Math.sin(frame.t * 0.035 + x * 0.9 + y * 1.7)
    const n = band * wobble * (1 - p) ** 1.45
    if (n > best) return n
    return best
  }, 0)
}

function remain(x: number, y: number, item: Release, t: number) {
  const age = t - item.at
  if (age < 0 || age > LIFE) return 0
  const p = age / LIFE
  const dx = x + 0.5 - item.x - 0.5
  const dy = y * 2 + 1 - item.y * 2 - 1
  const dist = Math.hypot(dx, dy)
  const span = Math.hypot(100, 8 * 2) * 0.94
  const r = span * (1 - (1 - p) ** EXPAND)
  if (dist > r) return 1
  return clamp((r - dist) / 1.35 < 1 ? 1 - (r - dist) / 1.35 : 0)
}

function wave(x: number, y: number, frame: Frame, live: boolean) {
  return frame.list.reduce((sum, item) => {
    const age = frame.t - item.at
    if (age < 0 || age > LIFE) return sum
    const p = age / LIFE
    const dx = x + 0.5 - item.x
    const dy = y * 2 + 1 - item.y
    const dist = Math.hypot(dx, dy)
    const span = Math.hypot(100, 8 * 2) * 0.94
    const r = span * (1 - (1 - p) ** EXPAND)
    const fade = (1 - p) ** 1.32
    const j = 1.02 + noise(x + item.x * 0.7, y + item.y * 0.7, item.at * 0.002 + age * 0.06) * 0.52
    const edge = Math.exp(-(((dist - r) / WIDTH) ** 2)) * GAIN * fade * item.force * j
    const swell = Math.exp(-(((dist - Math.max(0, r - DRIFT)) / WIDE) ** 2)) * SWELL * fade * item.force
    const trail =
      dist < r ? Math.exp(-(r - dist) / 2.4) * TRAIL * fade * item.force * lerp(0.92, 1.22, j) : 0
    const flash =
      Math.exp(-(dist * dist) / 3.2) * FLASH * item.force * Math.max(0, 1 - age / 140) * lerp(0.95, 1.18, j)
    const kick = Math.exp(-(dist * dist) / 2) * item.kick * Math.max(0, 1 - age / 100)
    const suck = Math.exp(-(((dist - 1.25) / 0.75) ** 2)) * item.kick * SUCK * Math.max(0, 1 - age / 110)
    const wake = live && dist < r ? Math.exp(-(r - dist) / 1.25) * 0.32 * fade : 0
    return sum + edge + swell + trail + flash + wake - kick - suck
  }, 0)
}

function field(x: number, y: number, frame: Frame) {
  const held = frame.hold
  const rest = frame.release
  const item = held ?? rest
  if (!item) return 0
  const rise = held ? ramp(frame.t - held.at, HOLD, CHARGE) : rest!.rise
  const level = held ? push(rise) : rest!.level
  const body = rise
  const storm = level * level
  const sink = held ? ramp(frame.t - held.at, SINK, CHARGE) : rest!.rise
  const dx = x + 0.5 - item.x - 0.5
  const dy = y * 2 + 1 - item.y * 2 - 1
  const dist = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx)
  const spin = frame.t * lerp(0.008, 0.018, storm)
  const dim = lerp(0, DIM, sink) * lerp(0.99, 1.01, 0.5 + 0.5 * Math.sin(frame.t * 0.014))
  const core = Math.exp(-(dist * dist) / Math.max(0.22, lerp(0.22, 3.2, body))) * lerp(0.42, 2.45, body)
  const shell =
    Math.exp(-(((dist - lerp(0.16, 2.05, body)) / Math.max(0.18, lerp(0.18, 0.82, body))) ** 2)) * lerp(0.1, 0.95, body)
  const ember =
    Math.exp(-(((dist - lerp(0.45, 2.65, body)) / Math.max(0.14, lerp(0.14, 0.62, body))) ** 2)) *
    lerp(0.02, 0.78, body)
  const arc = Math.max(0, Math.cos(angle * 3 - spin + frame.spark * 2.2)) ** 8
  const seam = Math.max(0, Math.cos(angle * 5 + spin * 1.55)) ** 12
  const ring = Math.exp(-(((dist - lerp(1.05, 3, level)) / 0.48) ** 2)) * arc * lerp(0.03, 0.5 + ARC, storm)
  const fork = Math.exp(-(((dist - (1.55 + storm * 2.1)) / 0.36) ** 2)) * seam * storm * FORK
  const spark = Math.max(0, noise(x, y, frame.t) - lerp(0.94, 0.66, storm)) * lerp(0, 5.4, storm)
  const glitch = spark * Math.exp(-dist / Math.max(1.2, 3.1 - storm))
  const crack = Math.max(0, Math.cos((dx - dy) * 1.6 + spin * 2.1)) ** 18
  const lash = crack * Math.exp(-(((dist - (1.95 + storm * 2)) / 0.28) ** 2)) * storm * 1.1
  const flicker =
    Math.max(0, noise(item.x * 3.1, item.y * 2.7, frame.t * 1.7) - 0.72) *
    Math.exp(-(dist * dist) / 0.15) *
    lerp(0.08, 0.42, body)
  const fade = frame.release && !frame.hold ? remain(x, y, frame.release, frame.t) : 1
  return (core + shell + ember + ring + fork + glitch + lash + flicker - dim) * fade
}

function pick(x: number, y: number, frame: Frame) {
  const held = frame.hold
  const rest = frame.release
  const item = held ?? rest
  if (!item) return 0
  const rise = held ? ramp(frame.t - held.at, HOLD, CHARGE) : rest!.rise
  const dx = x + 0.5 - item.x - 0.5
  const dy = y * 2 + 1 - item.y * 2 - 1
  const dist = Math.hypot(dx, dy)
  const fade = frame.release && !frame.hold ? remain(x, y, frame.release, frame.t) : 1
  return Math.exp(-(dist * dist) / 1.7) * lerp(0.2, 0.96, rise) * fade
}

function trace(x: number, y: number, frame: Frame, map: GlyphMap) {
  const held = frame.hold
  const rest = frame.release
  const item = held ?? rest
  if (!item || item.glyph === undefined) return 0
  const step = map.trace.get(key(x, y))
  if (!step || step.glyph !== item.glyph || step.l < 2) return 0
  const age = frame.t - item.at
  const rise = held ? ramp(age, HOLD, CHARGE) : rest!.rise
  const appear = held ? ramp(age, 0, TRACE_IN) : 1
  const speed = lerp(TRACE * 0.48, TRACE * 0.88, rise)
  const head = (age * speed) % step.l
  const dist = Math.min(Math.abs(step.i - head), step.l - Math.abs(step.i - head))
  const tail = (head - TAIL + step.l) % step.l
  const lag = Math.min(Math.abs(step.i - tail), step.l - Math.abs(step.i - tail))
  const fade = frame.release && !frame.hold ? remain(x, y, frame.release, frame.t) : 1
  const core = Math.exp(-((dist / 1.05) ** 2)) * lerp(0.8, 2.35, rise)
  const glow = Math.exp(-((dist / 1.85) ** 2)) * lerp(0.08, 0.34, rise)
  const trail = Math.exp(-((lag / 1.45) ** 2)) * lerp(0.04, 0.42, rise)
  return (core + glow + trail) * appear * fade
}

function bloom(x: number, y: number, frame: Frame, map: GlyphMap) {
  const item = frame.glow
  if (!item) return 0
  const glyph = map.glyph.get(key(x, y))
  if (glyph !== item.glyph) return 0
  const age = frame.t - item.at
  if (age < 0 || age > GLOW_OUT) return 0
  const p = age / GLOW_OUT
  const flash = (1 - p) ** 2
  const center = map.center.get(item.glyph)!
  const dx = x + 0.5 - center.x
  const dy = y * 2 + 1 - center.y
  const bias = Math.exp(-((Math.hypot(dx, dy) / 2.8) ** 2))
  return lerp(item.force, item.force * 0.18, p) * lerp(0.72, 1.1, bias) * flash
}

// --- Color blending ---

const BURST_PEAK = RGBA.fromInts(179, 133, 236) // brand lavender
const BURST_MID = RGBA.fromInts(141, 143, 255) // brand periwinkle

function burstGlow(base: RGBA, _theme: Theme, n: number) {
  const mid = tint(base, BURST_MID, 0.84)
  const top = tint(BURST_MID, BURST_PEAK, 0.96)
  if (n <= 1) return tint(base, mid, Math.min(1, Math.sqrt(Math.max(0, n)) * 1.14))
  return tint(mid, top, Math.min(1, 1 - Math.exp(-2.4 * (n - 1))))
}

export function burstShade(base: RGBA, theme: Theme, n: number) {
  if (n >= 0) return burstGlow(base, theme, n)
  return tint(base, theme.background, Math.min(0.82, -n * 0.64))
}

// --- BurstController ---

export class BurstController {
  private rings: Ring[] = []
  private holdState: Hold | undefined
  private releaseState: Release | undefined
  private glowState: Glow | undefined
  private now = 0
  private timer: ReturnType<typeof setInterval> | undefined
  private hum = false
  private map: GlyphMap | undefined
  private tickCallback: (() => void) | undefined
  private _spark = 0

  constructor(onTick?: () => void) {
    this.tickCallback = onTick
  }

  setGlyphMap(map: GlyphMap) {
    this.map = map
  }

  frame(): Frame {
    return {
      t: this.now,
      list: this.rings,
      hold: this.holdState,
      release: this.releaseState,
      glow: this.glowState,
      spark: this.holdState ? noise(this.holdState.x, this.holdState.y, this.now) : 0,
    }
  }

  duskFrame(): Frame {
    const base = this.frame()
    const t = base.t - LAG
    return {
      t,
      list: base.list,
      hold: base.hold,
      release: base.release,
      glow: base.glow,
      spark: base.hold ? noise(base.hold.x, base.hold.y, t) : 0,
    }
  }

  isActive(): boolean {
    return this.rings.length > 0 || !!this.holdState || !!this.releaseState || !!this.glowState
  }

  onMouse(evt: MouseEvent, boxX: number, boxY: number): void {
    if (!this.map) return
    if ((evt.type === "down" || evt.type === "drag") && evt.button === MouseButton.LEFT) {
      const x = evt.x - boxX
      const y = evt.y - boxY
      if (!this.hit(x, y)) return
      if (evt.type === "drag" && this.holdState) return
      evt.preventDefault()
      evt.stopPropagation()
      this.press(x, y, performance.now())
      return
    }

    if (!this.holdState) return
    if (evt.type === "up") {
      const item = this.holdState
      if (!item) return
      this.burst(item.x, item.y)
    }
  }

  handleDown(x: number, y: number): void {
    if (!this.map) return
    if (!this.hit(x, y)) return
    this.press(x, y, performance.now())
  }

  handleUp(): void {
    if (!this.holdState) return
    const item = this.holdState
    this.burst(item.x, item.y)
  }

  dispose(): void {
    this.stop()
    this.hum = false
  }

  private hit(x: number, y: number): boolean {
    if (!this.map) return false
    // Check the clicked cell and immediate neighbors in the glyph map
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (this.map.glyph.has(key(x + dx, y + dy))) return true
    }
    return false
  }

  private select(x: number, y: number): number | undefined {
    if (!this.map) return undefined
    const direct = this.map.glyph.get(key(x, y))
    if (direct !== undefined) return direct
    for (const [dx, dy] of NEAR) {
      const near = this.map.glyph.get(key(x + dx, y + dy))
      if (near !== undefined) return near
    }
    return undefined
  }

  private press(x: number, y: number, t: number) {
    const last = this.holdState
    if (last) this.burst(last.x, last.y)
    this.now = t
    if (!last) this.releaseState = undefined
    this.holdState = { x, y, at: t, glyph: this.select(x, y) }
    this.hum = false
    this.start()
  }

  private burst(x: number, y: number) {
    const item = this.holdState
    if (!item) return
    this.hum = false
    const t = performance.now()
    const age = t - item.at
    const rise = ramp(age, HOLD, CHARGE)
    const level = push(rise)
    this.holdState = undefined
    this.releaseState = { x, y, at: t, glyph: item.glyph, level, rise }
    if (item.glyph !== undefined) {
      this.glowState = { glyph: item.glyph, at: t, force: lerp(0.18, 1.5, rise * level) }
    }
    this.rings = [
      ...this.rings,
      {
        x: x + 0.5,
        y: y * 2 + 1,
        at: t,
        force: lerp(0.82, 2.55, level),
        kick: lerp(0.32, 0.32 + KICK, level),
      },
    ]
    this.now = t
    this.start()
  }

  private tick = () => {
    const t = performance.now()
    this.now = t
    const item = this.holdState
    if (item && t - item.at >= CHARGE) {
      this.burst(item.x, item.y)
    }
    let live = false
    this.rings = this.rings.filter((item) => {
      const keep = t - item.at < LIFE
      if (keep) live = true
      return keep
    })
    const flash = this.glowState
    if (flash && t - flash.at >= GLOW_OUT) {
      this.glowState = undefined
    }
    if (!live) this.releaseState = undefined
    if (live || this.holdState || this.releaseState || this.glowState) {
      this.tickCallback?.()
      return
    }
    this.stop()
    this.tickCallback?.()
  }

  private start() {
    if (this.timer) return
    this.timer = setInterval(this.tick, 16)
  }

  private stop() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = undefined
  }
}

// --- Rendering integration ---

export function computeBurstIntensity(col: number, row: number, frame: Frame, isGlyph: boolean, map: GlyphMap): number {
  const h = field(col, row, frame)
  const n = wave(col, row, frame, isGlyph) + h
  const p = isGlyph ? pick(col, row, frame) : 0
  const e = isGlyph ? trace(col, row, frame, map) : 0
  const b = isGlyph ? bloom(col, row, frame, map) : 0
  const q = shimmer(col, row, frame)
  return n + p + e + b + q * 0.3
}

export function applyBurst(
  tones: Tone[],
  row: number,
  frame: Frame,
  map: GlyphMap,
  theme: Theme,
): Tone[] {
  const out: Tone[] = []
  let buf = ""
  let curFg = tones[0]?.fg ?? RGBA.fromInts(255, 255, 255)

  const flush = () => {
    if (!buf) return
    out.push({ t: buf, fg: curFg })
    buf = ""
  }

  let col = 0
  for (const p of tones) {
    for (const ch of p.t) {
      let fg = p.fg
      if (isLogoBlockChar(ch)) {
        const intensity = computeBurstIntensity(col, row, frame, true, map)
        if (Math.abs(intensity) > 0.005) {
          fg = burstShade(p.fg, theme, intensity)
        }
      }
      if (fg !== curFg) {
        flush()
        curFg = fg
      }
      buf += ch
      col++
    }
  }
  flush()
  return out
}
