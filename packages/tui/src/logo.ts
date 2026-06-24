// DevEco Code Logo - Three G gradient design
// ░ ▒ █ are mapped to ▮ (U+25AE) at render time with different opacities
const CG_LEFT = [
  "  ░░░░░░░░░           ",
  " ░░░     ░░░          ",
  "░░░   ▒▒▒▒▒▒▒▒▒       ",
  "░░░  ▒▒▒     ▒▒▒      ",
  "░░░ ▒▒▒░░░█████████   ",
  " ░░░▒▒▒ ░███     ███  ",
  "  ░░▒▒▒░███▒▒▒▒▒      ",
  "     ▒▒▒███ ▒▒▒       ",
  "      ▒▒███▒▒▒▒█████  ",
  "         ███    ███   ",
  "          █████████   ",
]

const CG_RIGHT = [
  "  ＤＥＶＥＣＯ  ＣＯＤＥ",
  "                                                        ",
  "",
  "",
  "  {muted}Collaborate with {/muted}{link}DevEco Code.{/link}", // {link} → theme.info in renderLogoRightRow
  "  AI copilot for HarmonyOS application development",
  "  Powered by BitFun & OpenCode",
  "",
  "  ⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯",
  "",
  "",
]

export const logo = {
  left: CG_LEFT,
  right: CG_RIGHT,
  charMap: { "░": "▮", "▒": "▮", "█": "▮" },
  charOpacity: { "░": 0.15, "▒": 0.4, "█": 1.0 },
}

export const go = {
  left: CG_LEFT.slice(0, 4),
  right: CG_RIGHT.slice(0, 4),
  charMap: { "░": "▮", "▒": "▮", "█": "▮" },
  charOpacity: { "░": 0.15, "▒": 0.4, "█": 1.0 },
}

export const marks = "\x00"
