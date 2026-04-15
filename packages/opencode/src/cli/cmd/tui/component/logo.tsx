import { TextAttributes, RGBA } from "@opentui/core"
import { For, type JSX, createMemo } from "solid-js"
import { useTheme, tint } from "@tui/context/theme"
import { logo, marks } from "@/cli/logo"

const SHADOW_MARKER = new RegExp(`[${marks}]`)

// Type for logo with optional charMap and charOpacity
type LogoType = {
  left: string[]
  right: string[]
  charMap?: Record<string, string>
  charOpacity?: Record<string, number>
}

const typedLogo = logo as LogoType

export function Logo(props: { column?: "left" | "right" } = {}) {
  const { theme } = useTheme()
  const white = RGBA.fromInts(255, 255, 255)

  // Gradient: RGB(77,43,251) → RGB(220,73,170) by horizontal position
  function getGradientColor(position: number, totalWidth: number): RGBA {
    const ratio = Math.max(0, Math.min(1, position / totalWidth))
    const r = Math.round(77 + (220 - 77) * ratio)
    const g = Math.round(43 + (73 - 43) * ratio)
    const b = Math.round(251 + (170 - 251) * ratio)
    return RGBA.fromInts(r, g, b)
  }

  const totalWidth = createMemo(() => {
    let maxWidth = 0
    for (const line of typedLogo.left) {
      if (line.length > maxWidth) maxWidth = line.length
    }
    return maxWidth
  })

  const renderLogoRightRow = (rightLine: string, lineIndex: number): JSX.Element[] => {
    // Line 4: "Collaborate with CodeGenie" - highlight CodeGenie
    if (lineIndex === 4) {
      const text = rightLine
      const parts = text.split("CodeGenie")
      const els: JSX.Element[] = []
      if (parts[0]) {
        els.push(<text fg={theme.textMuted} selectable={false}>{parts[0]}</text>)
      }
      els.push(<text fg={theme.info} selectable={false}>CodeGenie</text>)
      return els
    }
    // Line 5: subtitle
    if (lineIndex === 5) {
      const els: JSX.Element[] = []
      for (let j = 0; j < rightLine.length; j++) {
        const ch = rightLine[j]
        if (ch === " ") els.push(<text selectable={false}> </text>)
        else els.push(<text fg={theme.textMuted} selectable={false}>{ch}</text>)
      }
      return els
    }
    // Line 6: "Powered by BITFUN & OpenCode" — keep white (not right-column gradient)
    if (lineIndex === 6 && rightLine.includes("Powered by")) {
      return [<text fg={white} selectable={false}>{rightLine}</text>]
    }
    // Line 8: separator line
    if (lineIndex === 8) {
      const dim = tint(theme.background, theme.textMuted, 0.5)
      const els: JSX.Element[] = []
      for (let j = 0; j < rightLine.length; j++) {
        const ch = rightLine[j]
        if (ch === " ") els.push(<text selectable={false}> </text>)
        else els.push(<text fg={dim} selectable={false}>{ch}</text>)
      }
      return els
    }
    // Line 0: CODE GENIE title
    if (lineIndex === 0) {
      return [<text fg={white} attributes={TextAttributes.BOLD} selectable={false}>{rightLine}</text>]
    }
    return renderLine(rightLine, 0, true, true)
  }

  const renderLine = (
    line: string,
    startPosition: number,
    bold: boolean,
    useGradient: boolean,
  ): JSX.Element[] => {
    const attrs = bold ? TextAttributes.BOLD : undefined
    const elements: JSX.Element[] = []
    let i = 0
    let currentPosition = startPosition

    while (i < line.length) {
      const rest = line.slice(i)
      const markerIndex = marks.length > 0 ? rest.search(SHADOW_MARKER) : -1

      if (markerIndex === -1) {
        const text = rest
        for (let j = 0; j < text.length; j++) {
          let char = text[j]
          if (typedLogo.charMap?.[char]) char = typedLogo.charMap[char]
          if (char === " ") {
            elements.push(<text attributes={attrs} selectable={false}> </text>)
          } else {
            let fg = useGradient ? getGradientColor(currentPosition + j, totalWidth()) : white
            const opacity = typedLogo.charOpacity?.[text[j]]
            if (useGradient && typeof opacity === "number") fg = tint(theme.background, fg, opacity)
            elements.push(
              <text fg={fg} attributes={attrs} selectable={false}>
                {char}
              </text>,
            )
          }
        }
        break
      }

      if (markerIndex > 0) {
        const text = rest.slice(0, markerIndex)
        for (let j = 0; j < text.length; j++) {
          let char = text[j]
          if (typedLogo.charMap?.[char]) char = typedLogo.charMap[char]
          if (char === " ") {
            elements.push(<text attributes={attrs} selectable={false}> </text>)
          } else {
            let fg = useGradient ? getGradientColor(currentPosition + j, totalWidth()) : white
            const opacity = typedLogo.charOpacity?.[text[j]]
            if (useGradient && typeof opacity === "number") fg = tint(theme.background, fg, opacity)
            elements.push(
              <text fg={fg} attributes={attrs} selectable={false}>
                {char}
              </text>,
            )
          }
        }
        currentPosition += markerIndex
      }

      const marker = rest[markerIndex]
      const fg = useGradient ? getGradientColor(currentPosition, totalWidth()) : white
      const shadow = tint(theme.background, fg, 0.45)
      switch (marker) {
        case "_":
          elements.push(
            <text fg={fg} bg={shadow} attributes={attrs} selectable={false}>
              {" "}
            </text>,
          )
          break
        case "^":
          elements.push(
            <text fg={fg} bg={shadow} attributes={attrs} selectable={false}>
              ▀
            </text>,
          )
          break
        case "~":
          elements.push(
            <text fg={shadow} attributes={attrs} selectable={false}>
              ▀
            </text>,
          )
          break
      }

      i += markerIndex + 1
      currentPosition += 1
    }

    return elements
  }

  if (props.column === "left") {
    return (
      <box flexDirection="column" flexShrink={0}>
        <For each={typedLogo.left}>
          {(line) => (
            <box flexDirection="row">{renderLine(line, 0, false, true)}</box>
          )}
        </For>
      </box>
    )
  }
  if (props.column === "right") {
    return (
      <box flexDirection="column" flexGrow={1} minWidth={0}>
        <For each={typedLogo.right}>
          {(rightLine, idx) => (
            <box flexDirection="row">{renderLogoRightRow(rightLine, idx())}</box>
          )}
        </For>
      </box>
    )
  }
  return (
    <box flexDirection="row" gap={2} alignItems="flex-start">
      <box flexDirection="column" flexShrink={0}>
        <For each={typedLogo.left}>
          {(line) => (
            <box flexDirection="row">{renderLine(line, 0, false, true)}</box>
          )}
        </For>
      </box>
      <box flexDirection="column" flexGrow={1} minWidth={0}>
        <For each={typedLogo.right}>
          {(rightLine, idx) => (
            <box flexDirection="row">{renderLogoRightRow(rightLine, idx())}</box>
          )}
        </For>
      </box>
    </box>
  )
}
