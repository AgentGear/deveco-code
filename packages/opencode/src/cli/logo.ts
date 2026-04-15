// CodeGenie Logo - Three G gradient design
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
  "ＣＯＤＥ  ＧＥＮＩＥ",
  "                                                        ",
  "",
  "",
  "Collaborate with CodeGenie",
  "AI copilot for HarmonyOS application development",
  "Powered by BITFUN & OpenCode",
  "",
  "⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯",
  "",
  "",
]

export const logo = {
  left: CG_LEFT,
  right: CG_RIGHT,
  charMap: { "\u2591": "\u25AE", "\u2592": "\u25AE", "\u2588": "\u25AE" },
  charOpacity: { "\u2591": 0.15, "\u2592": 0.4, "\u2588": 1.0 },
}

export const marks = "\x00"
