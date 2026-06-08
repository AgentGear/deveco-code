/** Erase the visible terminal area and move the cursor to the home position. */
export const CLEAR_TERMINAL_VIEW = "\x1b[2J\x1b[H"

/** Count logical rows in text that will be written to the terminal (trailing newline ignored). */
export function countTerminalLines(text: string): number {
  if (!text) return 0
  const normalized = text.endsWith("\n") ? text.slice(0, -1) : text
  if (!normalized) return 0
  return normalized.split("\n").length
}

/** Erase full-width rows starting at the current cursor row. */
export function eraseTerminalLines(lineCount: number): string {
  if (lineCount <= 0) return ""
  let seq = ""
  for (let i = 0; i < lineCount; i++) {
    seq += "\x1b[2K"
    if (i < lineCount - 1) seq += "\x1b[1B"
  }
  if (lineCount > 1) seq += `\x1b[${lineCount - 1}A`
  return seq
}
