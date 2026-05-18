import { For, createMemo } from "solid-js"
import { RGBA } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/context/theme"
import {
  bannerLogoPalette,
  bannerLogoScannedLineTones,
  LOGO_ROW_CAP,
  logoRowsForWidth,
  type Tone,
} from "./banner-logo"

/**
 * CodeGenie home banner.
 *
 * - Renders a fixed-height (8-row) ANSI lettermark using parsed SGR spans (supports 256-color + truecolor).
 * - Logo: full "DEVECO CODE" when the terminal is wide enough; otherwise "DEVECO"; if still too narrow,
 *   the lettermark is left-aligned and truncated (see `banner-logo.ts`).
 * - Adds a scanline effect by replacing spaces with `─`, plus optional full-width rules framing the logo.
 * - Taglines below are centered via left-padding (reliable in terminal layouts) and may use per-character gradient.
 */

export function Banner() {
  const { theme, mode } = useTheme()
  const dimensions = useTerminalDimensions()

  const width = createMemo(() => Math.max(0, Math.floor(dimensions().width)))
  const logoRows = createMemo(() => logoRowsForWidth(width()).slice(0, LOGO_ROW_CAP))

  const isLight = createMemo(() => mode() === "light")

  const logoPalette = createMemo(() => bannerLogoPalette(isLight(), theme))

  const bannerPalette = createMemo(() => {
    if (!isLight()) {
      return {
        gradLo: { r: 141, g: 143, b: 255 },
        gradHi: { r: 179, g: 133, b: 236 },
      }
    }

    return {
      gradLo: { r: 62, g: 64, b: 148 },
      gradHi: { r: 108, g: 58, b: 138 },
    }
  })

  const stripeTransparent = RGBA.fromInts(0, 0, 0, 0)
  const rule = createMemo(() => (width() <= 0 ? "" : "─".repeat(width())))

  const lerpInt = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
  const gradientAt = (i: number, steps: number) => {
    const { gradLo, gradHi } = bannerPalette()
    if (steps <= 1) return RGBA.fromInts(gradLo.r, gradLo.g, gradLo.b)
    const t = i / (steps - 1)
    return RGBA.fromInts(
      lerpInt(gradLo.r, gradHi.r, t),
      lerpInt(gradLo.g, gradHi.g, t),
      lerpInt(gradLo.b, gradHi.b, t),
    )
  }

  // Tagline (layout): center by left-padding based on visible character length (reliable in TUI).
  const taglineA = "Collaborate with "
  const taglineB = "DevEco Code"
  const taglineC = " An open-source AI agent for HarmonyOS application development"
  const taglineLen = taglineA.length + taglineB.length + taglineC.length
  const taglinePadLeft = createMemo(() => Math.max(0, Math.floor((width() - taglineLen) / 2)))

  // Secondary line (text): muted “Powered by …”, centered via left-padding.
  const poweredBy = "Powered by BitFun & OpenCode"
  const poweredByLen = poweredBy.length
  const poweredByPadLeft = createMemo(() => Math.max(0, Math.floor((width() - poweredByLen) / 2)))
  return (
    <box flexDirection="column" width={width()} backgroundColor={stripeTransparent}>
      <box flexDirection="column" width={width()} paddingTop={1} backgroundColor={stripeTransparent}>
        <For each={logoRows()}>
          {(line) => (
            <text bg={stripeTransparent} selectable={false}>
              <For each={bannerLogoScannedLineTones(line, width(), logoPalette())}>
                {(p: Tone) => <span style={{ fg: p.fg }}>{p.t}</span>}
              </For>
            </text>
          )}
        </For>
      </box>
      <box width={width()} paddingTop={2}>
        <text bg={stripeTransparent} selectable={false} wrapMode="none">
          <span style={{ fg: theme.textMuted }}>{`${" ".repeat(taglinePadLeft())}${taglineA}`}</span>
          <For each={[...taglineB]}>
            {(ch, i) => <span style={{ fg: gradientAt(i(), taglineB.length) }}>{ch}</span>}
          </For>
          <span style={{ fg: theme.textMuted }}>{taglineC}</span>
        </text>
      </box>
      <box width={width()}>
        <text bg={stripeTransparent} selectable={false} wrapMode="none">
          <span style={{ fg: theme.text }}>{`${" ".repeat(poweredByPadLeft())}${poweredBy}`}</span>
        </text>
      </box>
    </box>
  )
}
