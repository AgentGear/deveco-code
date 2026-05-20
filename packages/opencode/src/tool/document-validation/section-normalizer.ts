export function normalizeSectionTitle(title: string): string {
  return title
    .replace(/\*\*/g, "")
    .replace(/[　]/g, " ")
    .replace(/[：]/g, ":")
    .replace(/\s*\*\([^)]+\)\*/g, "")
    .replace(/[\s]+/g, " ")
    .trim()
}

export function matchesSection(title: string, candidates: string[]): boolean {
  const normalized = normalizeSectionTitle(title).toLowerCase()
  return candidates.some((c) => normalized === c.toLowerCase())
}

export function matchesFieldLabel(line: string, candidates: string[]): boolean {
  for (const c of candidates) {
    const pattern = new RegExp(`^[\\s]*[\\-\\*]?[\\s]*\\*?\\*?${escapeRegex(c)}\\*?\\*?[\\s]*[：:][\\s]*`, "i")
    if (pattern.test(line)) {
      return true
    }
  }
  return false
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
