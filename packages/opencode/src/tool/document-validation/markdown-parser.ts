import type { Section } from "./models"
import { normalizeSectionTitle } from "./section-normalizer"

export class SddMarkdownParser {
  private lines: string[]
  private codeFenceMask: boolean[]

  constructor(content: string) {
    const normalized = content.replace(/\r\n?/g, "\n")
    this.lines = normalized.split("\n")
    this.codeFenceMask = this.buildCodeFenceMask(this.lines)
  }

  private parseFenceOpener(line: string): { marker: string; length: number } | undefined {
    const match = line.match(/^\s*(```+|~~~+)/)
    return match ? { marker: match[1][0], length: match[1].length } : undefined
  }

  private isFenceCloser(line: string, fence: { marker: string; length: number }): boolean {
    return new RegExp(`^\\s*${fence.marker}{${fence.length},}\\s*$`).test(line)
  }

  private buildCodeFenceMask(lines: string[]): boolean[] {
    const mask = new Array(lines.length).fill(false)
    let activeFence: { marker: string; length: number } | undefined = undefined
    for (let i = 0; i < lines.length; i++) {
      if (!activeFence) {
        activeFence = this.parseFenceOpener(lines[i])
        if (activeFence) {
          mask[i] = true
        }
        continue
      }
      mask[i] = true
      if (this.isFenceCloser(lines[i], activeFence)) {
        activeFence = undefined
      }
    }
    return mask
  }

  parseSections(): Section[] {
    const sections: Section[] = []
    const stack: Section[] = []
    for (let i = 0; i < this.lines.length; i++) {
      if (this.codeFenceMask[i]) {
        continue
      }
      const match = this.lines[i].match(/^(#{1,6})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const title = match[2].trim()
        const content = this.getContentUntilNextHeader(i + 1, level)
        const section: Section = {
          level,
          title,
          normalizedTitle: normalizeSectionTitle(title),
          content,
          children: [],
          lineNumber: i + 1,
        }
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop()
        }
        if (stack.length === 0) {
          sections.push(section)
        } else {
          stack[stack.length - 1].children.push(section)
        }
        stack.push(section)
      }
    }
    return sections
  }

  private getContentUntilNextHeader(startLine: number, currentLevel: number): string {
    const contentLines: string[] = []
    for (let i = startLine; i < this.lines.length; i++) {
      if (this.codeFenceMask[i]) {
        contentLines.push(this.lines[i])
        continue
      }
      const headerMatch = this.lines[i].match(/^(#{1,6})\s+/)
      if (headerMatch && headerMatch[1].length <= currentLevel) {
        break
      }
      contentLines.push(this.lines[i])
    }
    return contentLines.join("\n").trim()
  }

  findSection(sections: Section[], predicate: (s: Section) => boolean): Section | undefined {
    for (const section of sections) {
      if (predicate(section)) {
        return section
      }
      const found = this.findSection(section.children, predicate)
      if (found) {
        return found
      }
    }
    return undefined
  }

  findSections(sections: Section[], predicate: (s: Section) => boolean): Section[] {
    const result: Section[] = []
    for (const section of sections) {
      if (predicate(section)) {
        result.push(section)
      }
      result.push(...this.findSections(section.children, predicate))
    }
    return result
  }
}
