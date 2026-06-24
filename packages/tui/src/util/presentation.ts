/**
 * Terminal scrollback presentation helpers.
 *
 * `sessionEpilogue()` is emitted to stderr when the active session changes
 * (title + continue command). The wordmark is the DevECode lettermark
 * rendered by `@opencode-ai/tui/component/banner-logo` so DevEco's CLI and
 * TUI share a single source of truth for the logo.
 */
import {
  bannerLogoPalette,
  formatBannerLogoAnsiLines,
  wordDevecoSmall,
} from "../component/banner-logo"

const reset = "\x1b[0m"
const bold = "\x1b[1m"
const dim = "\x1b[90m"

/**
 * Render the DevEco lettermark as ANSI truecolor lines for scrollback.
 *
 * Uses `wordDevecoSmall` (5-row `▂▃▄▅▆` "DEVECO" block mark) with a
 * dark-mode palette. The palette is fixed because scrollback is emitted
 * outside the TUI and cannot read the user's theme; dark terminals are the
 * dominant case for CLI users.
 */
function wordmark(pad = ""): string[] {
  const palette = bannerLogoPalette(false, {
    text: { r: 1, g: 1, b: 1, a: 1 } as never,
    textMuted: { r: 0.5, g: 0.5, b: 0.5, a: 1 } as never,
    border: { r: 0.2, g: 0.2, b: 0.2, a: 1 } as never,
    background: { r: 0, g: 0, b: 0, a: 1 } as never,
  })
  return formatBannerLogoAnsiLines(80, palette, {
    rows: wordDevecoSmall,
    align: "start",
  }).map((line) => `${pad}${line}`)
}

export function sessionEpilogue(input: { title: string; sessionID?: string }) {
  const weak = (text: string) => `${dim}${text.padEnd(10, " ")}${reset}`
  return [
    ...wordmark("  "),
    "",
    `  ${weak("Session")}${bold}${input.title}${reset}`,
    `  ${weak("Continue")}${bold}deveco -s ${input.sessionID}${reset}`,
    "",
  ].join("\n")
}
