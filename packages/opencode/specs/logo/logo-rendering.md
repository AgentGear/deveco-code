# CodeGenie Logo Gradient Effect

Visual design and rendering specification for the CodeGenie logo in terminal/TUI applications.

## Overview

The logo features a horizontal purple-to-pink gradient applied to ASCII art characters. The left side displays a "Three G" design using Unicode block characters with varying opacity levels, creating depth and a modern aesthetic. The right side provides contextual text with hierarchical styling.

### Visual Layout

```
Left Column              Right Column
  ░░░░░░░░░              ＣＯＤＥ  ＧＥＮＩＥ
 ░░░     ░░░             
░░░   ▒▒▒▒▒▒▒▒▒          Collaborate with CodeGenie
░░░  ▒▒▒     ▒▒▒         AI copilot for HarmonyOS...
░░░ ▒▒▒░░░█████████      Powered by BITFUN & OpenCode
 ░░░▒▒▒ ░███     ███     
  ░░▒▒▒░███▒▒▒▒▒         ⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯
     ▒▒▒███ ▒▒▒          
      ▒▒███▒▒▒▒█████     
         ███    ███      
          █████████      
```

## Gradient System

### Color Range

| Position | RGB | Hex | Description |
|----------|-----|-----|-------------|
| Start (left) | (77, 43, 251) | #4D2BFB | Purple |
| End (right) | (220, 73, 170) | #DC49AA | Pink |

### Calculation Formula

```typescript
function getGradientColor(x: number, totalWidth: number): RGB {
  const ratio = Math.max(0, Math.min(1, x / totalWidth))
  return {
    r: Math.round(77 + (220 - 77) * ratio),
    g: Math.round(43 + (73 - 43) * ratio),
    b: Math.round(251 + (170 - 251) * ratio)
  }
}
```

## Character System

### Block Characters

The design uses three Unicode shade characters mapped to a single rendering character with different opacity:

| Source | Unicode | Renders As | Unicode | Opacity | Visual Effect |
|--------|---------|------------|---------|---------|---------------|
| ░ | U+2591 | ▮ | U+25AE | 0.15 | Ghostly/faint |
| ▒ | U+2592 | ▮ | U+25AE | 0.40 | Semi-visible |
| █ | U+2588 | ▮ | U+25AE | 1.00 | Solid |

### Opacity Blending

Characters are blended toward a dark background color:

```typescript
const DARK_BG = { r: 12, g: 12, b: 24 }

function blendOpacity(color: RGB, opacity: number): RGB {
  return {
    r: Math.round(color.r * opacity + DARK_BG.r * (1 - opacity)),
    g: Math.round(color.g * opacity + DARK_BG.g * (1 - opacity)),
    b: Math.round(color.b * opacity + DARK_BG.b * (1 - opacity))
  }
}
```

## Data Model

### Logo Shape Interface

```typescript
interface LogoShape {
  left: string[]
  right: string[]
  charMap?: Record<string, string>
  charOpacity?: Record<string, number>
}
```

### Logo Definition

```typescript
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
  "  ＣＯＤＥ  ＧＥＮＩＥ",
  "                                                        ",
  "",
  "",
  "  {muted}Collaborate with {/muted}{link}CodeGenie{/link}",
  "  AI copilot for HarmonyOS application development",
  "  Powered by BITFUN & OpenCode",
  "",
  "  ⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯",
  "",
  "",
]

export const logo: LogoShape = {
  left: CG_LEFT,
  right: CG_RIGHT,
  charMap: { "\u2591": "\u25AE", "\u2592": "\u25AE", "\u2588": "\u25AE" },
  charOpacity: { "\u2591": 0.15, "\u2592": 0.40, "\u2588": 1.0 },
}
```

## Rendering

### TUI Component (SolidJS)

```tsx
function Logo(props: { shape?: LogoShape; column?: "left" | "right" }) {
  const activeShape = props.shape ?? logo
  const totalWidth = Math.max(...activeShape.left.map(line => line.length))
  
  const renderLine = (line: string): JSX.Element[] => {
    return line.split("").map((char, x) => {
      const srcChar = char
      
      // Apply character mapping
      if (activeShape.charMap?.[char]) {
        char = activeShape.charMap[char]
      }
      
      if (char === " ") return <text> </text>
      
      // Calculate gradient
      let color = getGradientColor(x, totalWidth)
      
      // Apply opacity
      const opacity = activeShape.charOpacity?.[srcChar]
      if (opacity !== undefined) {
        color = blendOpacity(color, opacity)
      }
      
      return <text fg={color}>{char}</text>
    })
  }
  
  // Render based on column prop...
}
```

### ANSI Terminal

```typescript
function drawLogo(): string {
  const totalWidth = Math.max(...logo.left.map(l => l.length))
  const reset = "\x1b[0m"
  
  const ansiFg = (rgb: RGB) => `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m`
  
  return logo.left.map(line => 
    line.split("").map((char, x) => {
      const src = char
      if (logo.charMap?.[char]) char = logo.charMap[char]
      if (char === " ") return " "
      
      let rgb = getGradientColor(x, totalWidth)
      const opacity = logo.charOpacity?.[src]
      if (opacity !== undefined) rgb = blendOpacity(rgb, opacity)
      
      return ansiFg(rgb) + char + reset
    }).join("")
  ).join("\n")
}
```

## Right Side Styling

### Text Tags

The right side supports inline styling tags:

| Tag | Effect |
|-----|--------|
| `{muted}text{/muted}` | Muted gray color (theme.textMuted) |
| `{link}text{/link}` | Accent color with bold (theme.info) |

Example:
```typescript
"  {muted}Collaborate with {/muted}{link}CodeGenie{/link}"
// Renders: "Collaborate with" in muted gray, "CodeGenie" in accent color
```

### Line-by-Line Rules

| Line | Content | Style |
|------|---------|-------|
| 0 | CODE GENIE | Bold white |
| 4 | Collaborate with **CodeGenie** | Use `{muted}` and `{link}` tags |
| 5 | Subtitle | Muted gray |
| 6 | Powered by... | White |
| 8 | Separator dots | 50% dimmed |

### Tag Parsing Implementation

```typescript
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
    // Handle plain text between tags...
    const nextTag = Math.min(
      ...[s.indexOf("{muted}"), s.indexOf("{link}")].filter(x => x >= 0)
    )
    const plainEnd = nextTag >= 0 ? nextTag : s.length
    if (plainEnd > 0) {
      segments.push({ text: s.slice(0, plainEnd), muted: false, link: false })
    }
    s = s.slice(plainEnd)
  }
  return segments
}

## Component Modes

```tsx
// Full logo (both columns)
<Logo />

// Left column only
<Logo column="left" />

// Right column only
<Logo column="right" />

// Custom shape
<Logo shape={customLogo} />
```

## Implementation Checklist

- [ ] Define ASCII art arrays (left/right)
- [ ] Create charMap (░▒█ → ▮)
- [ ] Create charOpacity (0.15, 0.40, 1.0)
- [ ] Implement gradient calculation (purple → pink)
- [ ] Implement opacity blending toward dark
- [ ] Implement `{muted}` and `{link}` tag parsing for right side
- [ ] Apply right-side line styling rules
- [ ] Support column-based rendering
- [ ] Use `\x1b[38;2;R;G;Bm` for ANSI 24-bit color
- [ ] Use RGBA objects for TUI components

## File References

- `src/cli/logo.ts` - Logo data definition
- `src/cli/cmd/tui/component/logo.tsx` - TUI component
- `src/cli/ui.ts` - ANSI terminal rendering