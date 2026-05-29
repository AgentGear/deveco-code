import { describe, expect, test } from "bun:test"
import {
  CLEAR_TERMINAL_VIEW,
  countTerminalLines,
  eraseTerminalLines,
} from "@/cli/cmd/tui/terminal-screen"

describe("terminal-screen", () => {
  test("countTerminalLines ignores a trailing newline", () => {
    expect(countTerminalLines("a\nb\n")).toBe(2)
    expect(countTerminalLines("")).toBe(0)
  })

  test("eraseTerminalLines clears each row and returns the cursor", () => {
    expect(eraseTerminalLines(1)).toBe("\x1b[2K")
    expect(eraseTerminalLines(3)).toBe("\x1b[2K\x1b[1B\x1b[2K\x1b[1B\x1b[2K\x1b[2A")
  })

  test("CLEAR_TERMINAL_VIEW clears the display", () => {
    expect(CLEAR_TERMINAL_VIEW).toBe("\x1b[2J\x1b[H")
  })
})
