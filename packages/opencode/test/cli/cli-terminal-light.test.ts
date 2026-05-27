import { describe, expect, test } from "bun:test"
import {
  parseColorFgbg,
  parseOsc11,
  warpThemeNameIsLight,
  windowsTerminalSchemeIsLight,
} from "../../src/cli/cmd/tui/util/cli-terminal-light"

describe("parseOsc11", () => {
  test("parses rgb and hex background responses", () => {
    expect(parseOsc11("\x1b]11;rgb:ffff/ffff/ffff\x07")).toEqual({ r: 1, g: 1, b: 1 })
    expect(parseOsc11("\x1b]11;#ffffff\x1b\\")).toEqual({ r: 1, g: 1, b: 1 })
    expect(parseOsc11("no response")).toBe(undefined)
  })
})

describe("parseColorFgbg", () => {
  test("detects light 16-color background", () => {
    expect(parseColorFgbg("0;15")).toBe(true)
    expect(parseColorFgbg("15;0")).toBe(false)
  })

  test("detects light rgb background", () => {
    expect(parseColorFgbg("0;15;rgb:ffff/ffff/ffff")).toBe(true)
    expect(parseColorFgbg("15;0;rgb:0000/0000/0000")).toBe(false)
  })
})

describe("warpThemeNameIsLight", () => {
  test("recognizes warp built-in theme names", () => {
    expect(warpThemeNameIsLight("light")).toBe(true)
    expect(warpThemeNameIsLight("dark")).toBe(false)
    expect(warpThemeNameIsLight("solarized_light")).toBe(true)
    expect(warpThemeNameIsLight("dracula")).toBe(undefined)
  })
})

describe("windowsTerminalSchemeIsLight", () => {
  test("uses scheme name and background color", () => {
    expect(windowsTerminalSchemeIsLight("One Half Light", undefined)).toBe(true)
    expect(windowsTerminalSchemeIsLight("Campbell Powershell", undefined)).toBe(undefined)
    expect(
      windowsTerminalSchemeIsLight("Campbell", [{ name: "Campbell", background: "#0C0C0C" }]),
    ).toBe(false)
    expect(
      windowsTerminalSchemeIsLight("Custom", [{ name: "Custom", background: "#FFFFFF" }]),
    ).toBe(true)
  })
})
