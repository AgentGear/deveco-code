import { TextAttributes, RGBA } from "@opentui/core"
import { For, type JSX, createMemo } from "solid-js"
import { useTheme, tint } from "@tui/context/theme"
import { logo, go, marks } from "@/cli/logo"

const SHADOW_MARKER = new RegExp(`[${marks}]`)

// Type for logo with optional charMap and charOpacity
type LogoType = {
  left: string[]
  right: string[]
  charMap?: Record<string, string>
  charOpacity?: Record<string, number>
}

const typedLogo = logo as LogoType

type TextSegment = { text: string; muted: boolean; link: boolean }

function parseSegments(line: string): TextSegment[] {
  const segments: TextSegment[] = []
  let s = line
  while (s.length > 0) {
    if (s.startsWith("{muted}")) {
      s = s.slice(7)
      const end = s.indexOf("{/muted}")
      if (end === -1) break
      segments.push({ text: s.slice(0, end), muted: true, link: false })
      s = s.slice(end + 8)
      continue
    }
    if (s.startsWith("{link}")) {
      s = s.slice(6)
      const end = s.indexOf("{/link}")
      if (end === -1) break
      segments.push({ text: s.slice(0, end), muted: false, link: true })
      s = s.slice(end + 7)
      continue
    }
    const a = s.indexOf("{muted}")
    const b = s.indexOf("{link}")
    const candidates = [a, b].filter((x) => x >= 0)
    const n = candidates.length ? Math.min(...candidates) : s.length
    const plain = s.slice(0, n)
    if (plain) {
      segments.push({ text: plain, muted: false, link: false })
    }
    s = s.slice(n)
  }
  return segments
}

export function Logo(props: { shape?: LogoType; column?: "left" | "right" } = {}) {
  const { theme } = useTheme()
  const white = RGBA.fromInts(255, 255, 255)
  const activeShape = props.shape ?? typedLogo

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
    for (const line of activeShape.left) {
      if (line.length > maxWidth) maxWidth = line.length
    }
    return maxWidth
  })

  const renderTextSegment = (segment: TextSegment): JSX.Element[] => {
    const fg = segment.muted ? theme.textMuted : segment.link ? theme.info : white
    const attrs = segment.link ? TextAttributes.BOLD : undefined
    return segment.text.split("").map((ch) =>
      ch === " " ? <text selectable={false}> </text> : <text fg={fg} attributes={attrs} selectable={false}>{ch}</text>
    )
  }

  const renderLogoRightRow = (rightLine: string, lineIndex: number): JSX.Element[] => {
    const hasTags = rightLine.includes("{muted}") || rightLine.includes("{link}")
    
    // Line 0: CODE GENIE title - bold white
    if (lineIndex === 0) {
      return [<text fg={white} attributes={TextAttributes.BOLD} selectable={false}>{rightLine}</text>]
    }
    
    // Line 6: "Powered by BITFUN & OpenCode" — white
    if (lineIndex === 6 && rightLine.includes("Powered by")) {
      return [<text fg={white} selectable={false}>{rightLine}</text>]
    }
    
    // Line 8: separator line - dimmed
    if (lineIndex === 8) {
      const dim = tint(theme.background, theme.textMuted, 0.5)
      const els: JSX.Element[] = []
      for (const ch of rightLine) {
        if (ch === " ") els.push(<text selectable={false}> </text>)
        else els.push(<text fg={dim} selectable={false}>{ch}</text>)
      }
      return els
    }
    
    // Lines with tags: parse and render segments
    if (hasTags) {
      const segments = parseSegments(rightLine)
      if (segments.length === 0) {
        const stripped = rightLine.replace(/\{muted\}|\{\/muted\}|\{link\}|\{\/link\}/g, "")
        return renderTextSegment({ text: stripped, muted: false, link: false })
      }
      return segments.flatMap(renderTextSegment)
    }
    
    // Default: muted text for subtitle lines
    if (lineIndex === 5) {
      return renderTextSegment({ text: rightLine, muted: true, link: false })
    }
    
    return renderTextSegment({ text: rightLine, muted: false, link: false })
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
          if (activeShape.charMap?.[char]) char = activeShape.charMap[char]
          if (char === " ") {
            elements.push(<text attributes={attrs} selectable={false}> </text>)
          } else {
            let fg = useGradient ? getGradientColor(currentPosition + j, totalWidth()) : white
            const opacity = activeShape.charOpacity?.[text[j]]
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
          if (activeShape.charMap?.[char]) char = activeShape.charMap[char]
          if (char === " ") {
            elements.push(<text attributes={attrs} selectable={false}> </text>)
          } else {
            let fg = useGradient ? getGradientColor(currentPosition + j, totalWidth()) : white
            const opacity = activeShape.charOpacity?.[text[j]]
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
        <For each={activeShape.left}>
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
        <For each={activeShape.right}>
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
        <For each={activeShape.left}>
          {(line) => (
            <box flexDirection="row">{renderLine(line, 0, false, true)}</box>
          )}
        </For>
      </box>
      <box flexDirection="column" flexGrow={1} minWidth={0}>
        <For each={activeShape.right}>
          {(rightLine, idx) => (
            <box flexDirection="row">{renderLogoRightRow(rightLine, idx())}</box>
          )}
        </For>
      </box>
    </box>
  )
}

export function GoLogo() {
  return <Logo shape={go as LogoType} column="left" />
}