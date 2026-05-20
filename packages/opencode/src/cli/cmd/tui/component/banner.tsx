import { For, createMemo } from "solid-js";
import { RGBA } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/solid";
import { useTheme } from "@tui/context/theme";
import {
  bannerLogoPalette,
  bannerLogoScannedLineTones,
  LOGO_ROW_CAP,
  logoRowsForWidth,
  type Tone,
} from "./banner-logo";

/**
 * DevEco Code home banner.
 *
 * - Renders a fixed-height (8-row) ANSI lettermark using parsed SGR spans (supports 256-color + truecolor).
 * - Logo: full "DEVECO CODE" when the terminal is wide enough; otherwise "DEVECO"; if still too narrow,
 *   the lettermark is left-aligned and truncated (see `banner-logo.ts`).
 * - Adds a scanline effect by replacing spaces with `─`, plus optional full-width rules framing the logo.
 * - Taglines below are centered via left-padding (reliable in terminal layouts) and may use per-character gradient.
 */

/** Home / onboarding horizontal padding: outer 2+2 and inner 2+2. */
export const BANNER_HOME_CONTENT_INSET = 8;

/** Shared max width for banner, prompt, and onboarding body. */
export const HOME_CONTENT_MAX_WIDTH = 110;

/** Maximum rows for the region below the banner when the terminal is tall enough. */
export const HOME_BODY_MAX_ROWS = 18;

/** @deprecated Use {@link HOME_BODY_MAX_ROWS}. */
export const HOME_BODY_MIN_ROWS = HOME_BODY_MAX_ROWS;

/** Preferred minimum body slot rows; may shrink further when the terminal is very short. */
export const HOME_BODY_SLOT_FLOOR_ROWS = 8;

/** Gap between banner and body slot (terminal rows). */
export const HOME_BODY_GAP_ROWS = 2;

/** Logo block + taglines + padding (see `Banner` layout). */
export const HOME_BANNER_ESTIMATE_ROWS = 1 + LOGO_ROW_CAP + 2 + 2;

/** Reserved rows for `home_footer` and outer vertical breathing room. */
export const HOME_LAYOUT_FOOTER_ROWS = 2;
export const HOME_LAYOUT_MARGIN_ROWS = 2;

/** Body slot rows from terminal height: capped at {@link HOME_BODY_MAX_ROWS}, shrinks when space is tight. */
export function homeBodySlotRows(terminalHeight: number): number {
  const h = Math.max(0, Math.floor(terminalHeight));
  const reserved =
    HOME_BANNER_ESTIMATE_ROWS + HOME_BODY_GAP_ROWS + HOME_LAYOUT_FOOTER_ROWS + HOME_LAYOUT_MARGIN_ROWS;
  const available = h - reserved;
  if (available <= HOME_BODY_SLOT_FLOOR_ROWS) {
    return Math.max(4, available);
  }
  return Math.min(HOME_BODY_MAX_ROWS, available);
}

/** Max textarea rows on the home prompt when the body slot is tall. */
export const HOME_PROMPT_MAX_TEXTAREA_ROWS = 4;

/** Min textarea rows on the home prompt when the terminal is short. */
export const HOME_PROMPT_MIN_TEXTAREA_ROWS = 2;

/** Rows used by home prompt border + idle footer (not the textarea). */
export const HOME_PROMPT_CHROME_ROWS = 3;

/** Rows reserved for `home_bottom` tips when estimating prompt height. */
export const HOME_PROMPT_TIPS_RESERVE_ROWS = 4;

/** Home prompt textarea rows from the shared body slot height. */
export function homePromptTextareaRows(
  bodySlotHeight: number,
  tipsReserveRows: number = HOME_PROMPT_TIPS_RESERVE_ROWS,
): number {
  const inner = Math.max(0, bodySlotHeight - HOME_BODY_GAP_ROWS);
  const available = inner - HOME_PROMPT_CHROME_ROWS - Math.max(0, tipsReserveRows);
  if (available <= HOME_PROMPT_MIN_TEXTAREA_ROWS) {
    return Math.max(1, available);
  }
  return Math.min(HOME_PROMPT_MAX_TEXTAREA_ROWS, available);
}

export function Banner(props?: { contentInset?: number }) {
  const { theme, mode } = useTheme();
  const dimensions = useTerminalDimensions();

  const width = createMemo(() => {
    const inset = props?.contentInset ?? 0;
    return Math.max(0, Math.floor(dimensions().width) - inset);
  });
  const logoRows = createMemo(() => logoRowsForWidth(width()).slice(0, LOGO_ROW_CAP));

  const isLight = createMemo(() => mode() === "light");

  const logoPalette = createMemo(() => bannerLogoPalette(isLight(), theme));

  const bannerPalette = createMemo(() => {
    if (!isLight()) {
      return {
        gradLo: { r: 141, g: 143, b: 255 },
        gradHi: { r: 179, g: 133, b: 236 },
      };
    }

    return {
      gradLo: { r: 62, g: 64, b: 148 },
      gradHi: { r: 108, g: 58, b: 138 },
    };
  });

  const stripeTransparent = RGBA.fromInts(0, 0, 0, 0);
  const rule = createMemo(() => (width() <= 0 ? "" : "─".repeat(width())));

  const lerpInt = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  const gradientAt = (i: number, steps: number) => {
    const { gradLo, gradHi } = bannerPalette();
    if (steps <= 1) return RGBA.fromInts(gradLo.r, gradLo.g, gradLo.b);
    const t = i / (steps - 1);
    return RGBA.fromInts(
      lerpInt(gradLo.r, gradHi.r, t),
      lerpInt(gradLo.g, gradHi.g, t),
      lerpInt(gradLo.b, gradHi.b, t),
    );
  };

  // Tagline (layout): center by left-padding based on visible character length (reliable in TUI).
  const taglineA = "Collaborate with ";
  const taglineB = "DevEco Code";
  const taglineC = " An open-source AI agent for HarmonyOS application development";
  const taglineLen = taglineA.length + taglineB.length + taglineC.length;
  const taglinePadLeft = createMemo(() => Math.max(0, Math.floor((width() - taglineLen) / 2)));

  // Secondary line (text): muted “Powered by …”, centered via left-padding.
  const poweredBy = "Powered by BITFUN & OpenCode";
  const poweredByLen = poweredBy.length;
  const poweredByPadLeft = createMemo(() => Math.max(0, Math.floor((width() - poweredByLen) / 2)));
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
  );
}
