import { readFileSync } from "fs"
import * as Log from "@opencode-ai/core/util/log"
import { SddMarkdownParser } from "./markdown-parser"
import { FORMAT_RULES } from "./config"
import type { Section } from "./models"

const log = Log.create({ service: "document-validation" })

const SECTION_ALIASES: Record<string, string[]> = {
  "Feature Specification:": ["功能规格:", "特性规格:", "Feature Specification"],
  Overview: ["概述", "概览"],
  "User Scenarios & Testing": [
    "User Scenarios and Testing",
    "用户场景与测试",
    "用户场景和测试",
    "用户场景与测试 (必填)",
  ],
  Requirements: ["需求", "Requirements (mandatory)", "需求 (必填)"],
  "Success Criteria": ["成功标准", "验收标准", "Success Criteria (mandatory)", "成功标准 (必填)"],
  Assumptions: ["假设"],
  "Open Questions": ["开放问题", "待解决问题"],
  "Implementation Plan:": ["实现计划:", "实施计划:", "Implementation Plan"],
  Summary: ["摘要", "总结"],
  "Technical Context": ["技术背景", "技术上下文"],
  "Project Structure": ["项目结构"],
  "Complexity Tracking": ["复杂度追踪", "复杂性跟踪"],
  "Research & Decisions": ["研究与决策", "调研与决策", "Research and Decisions"],
  "Data Model": ["数据模型"],
  "Contracts & Interfaces": ["契约与接口", "接口与契约", "Contracts and Interfaces"],
  Quickstart: ["快速开始", "快速入门"],
  Changelog: ["变更日志", "更新日志"],
  "Tasks:": ["任务:", "任务列表:", "Tasks"],
  Format: ["格式", "Format: `[ID] [P?] [Story] Description`"],
  "Path Conventions": ["路径约定", "路径规范"],
  "Dependencies & Execution Order": ["📊 Dependencies & Execution Order", "依赖与执行顺序", "依赖和执行顺序", "Dependencies and Execution Order"],
  "Parallel Example": ["并行示例", "Parallel Example:", "Parallel Examples"],
  "Dependency Graph": ["📊 Dependency Graph", "依赖图"],
  "Parallel Execution Guide": ["⚡ Parallel Execution Guide", "并行执行指南"],
  "Implementation Strategy": ["实现策略", "实施策略"],
  Notes: ["备注", "注释"],
}

function flattenSections(sections: Section[]): Section[] {
  return sections.flatMap((s) => [s, ...flattenSections(s.children)])
}

function exactMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function prefixMatch(title: string, prefix: string, level?: number): boolean {
  if (level !== 1 && level !== 2) {
    return false
  }
  const lower = title.toLowerCase()
  const prefixLower = prefix.toLowerCase()
  return prefixLower.endsWith(":") && lower.startsWith(prefixLower)
}

function matchesSectionTitle(sectionTitle: string, standardTitle: string, level?: number): boolean {
  if (exactMatch(sectionTitle, standardTitle)) {
    return true
  }
  if (prefixMatch(sectionTitle, standardTitle, level)) {
    return true
  }

  const aliases = SECTION_ALIASES[standardTitle] ?? []
  for (const alias of aliases) {
    if (exactMatch(sectionTitle, alias)) {
      return true
    }
    if (prefixMatch(sectionTitle, alias, level)) {
      return true
    }
  }
  return false
}

function findDuplicateSections(sections: Section[]): Array<{ title: string; level: number; count: number }> {
  const counts = new Map<string, { count: number; originalTitle: string }>()
  for (const s of sections) {
    const key = `${s.level}|${s.normalizedTitle.toLowerCase()}`
    const existing = counts.get(key)
    if (existing) {
      existing.count++
    } else {
      counts.set(key, { count: 1, originalTitle: s.title })
    }
  }
  return [...counts.entries()]
    .filter(([, v]) => v.count > 1)
    .map(([key, v]) => {
      const [levelStr] = key.split("|", 2)
      return { title: v.originalTitle, level: parseInt(levelStr), count: v.count }
    })
}

function isAllowedLevel2Section(title: string, documentType: string, allowedSections: string[]): boolean {
  // tasks type: dynamically allow Phase X headings
  if (documentType === "tasks" && /^Phase /.test(title)) {
    return true
  }

  return allowedSections.some((allowed) => matchesSectionTitle(title, allowed, 2))
}

function findMissingSections(allSections: Section[], rules: (typeof FORMAT_RULES)["spec"]) {
  const missing: string[] = []
  for (const req of rules.requiredSections) {
    const found = allSections.some(
      (s) => s.level === req.level && matchesSectionTitle(s.normalizedTitle, req.standardTitle, req.level),
    )
    if (!found) {
      missing.push(req.standardTitle)
      log.warn(`[validateDocumentSimple] missing required section: level=${req.level}, title=${req.standardTitle}`)
    }
  }
  return missing
}

function findExtraSections(allSections: Section[], documentType: string, rules: (typeof FORMAT_RULES)["spec"]) {
  const extra: string[] = []
  const level2Sections = allSections.filter((s) => s.level === 2)
  for (const s of level2Sections) {
    if (!isAllowedLevel2Section(s.normalizedTitle, documentType, rules.allowedSections)) {
      extra.push(s.title)
      log.warn(`[validateDocumentSimple] extra section: ## ${s.title}`)
    }
  }
  return extra
}

function findTooManyLevel2Sections(allSections: Section[], max: number): Array<{ title: string; count: number }> {
  const level2Count = allSections.filter((s) => s.level === 2).length
  if (level2Count > max) {
    return [{ title: `## sections`, count: level2Count }]
  }
  return []
}

function formatReportLine(title: string, level: number): string {
  const prefix = level === 1 ? "# " : "## "
  return `  - ${prefix}${title}\n`
}

function formatValidationReport(
  missing: string[],
  extra: string[],
  duplicates: Array<{ title: string; level: number; count: number }>,
  tooManyLevel2: Array<{ title: string; count: number }>,
): string {
  let result = "\n\n--- Document Section Validation ---\n"
  if (missing.length > 0) {
    result += "Missing required sections:\n"
    for (const m of missing) {
      result += formatReportLine(m, 1)
    }
  }
  if (duplicates.length > 0) {
    result += "Duplicate sections (not allowed):\n"
    for (const d of duplicates) {
      result += formatReportLine(`${d.title} (appears ${d.count} times)`, d.level)
    }
  }
  if (extra.length > 0) {
    result += "Extra sections (not allowed):\n"
    for (const e of extra) {
      result += formatReportLine(e, 2)
    }
  }
  if (tooManyLevel2.length > 0) {
    result += `Too many level-2 sections (max ${tooManyLevel2[0].count} allowed):\n`
    for (const t of tooManyLevel2) {
      result += `  - ${t.title}: ${t.count}\n`
    }
  }
  result += "-----------------------------------\n"
  return result
}

export function validateDocumentSimple(filePath: string, documentType: "spec" | "design" | "tasks"): string {
  log.info(`[validateDocumentSimple] start: file=${filePath}, type=${documentType}`)

  const content = readFileSync(filePath, "utf-8")
  const parser = new SddMarkdownParser(content)
  const sections = parser.parseSections()
  const allSections = flattenSections(sections)
  const rules = FORMAT_RULES[documentType]

  log.info(`[validateDocumentSimple] parsed ${allSections.length} sections`)

  const missing = findMissingSections(allSections, rules)
  const extra = findExtraSections(allSections, documentType, rules)
  const duplicates = findDuplicateSections(allSections)
  const tooManyLevel2 = findTooManyLevel2Sections(allSections, rules.maxSectionLevel2)

  if (missing.length === 0 && extra.length === 0 && duplicates.length === 0 && tooManyLevel2.length === 0) {
    log.info(`[validateDocumentSimple] passed: no issues found`)
    return ""
  }

  log.info(
    `[validateDocumentSimple] failed: missing=${missing.length}, extra=${extra.length}, duplicates=${duplicates.length}, tooManyLevel2=${tooManyLevel2.length}`,
  )
  return formatValidationReport(missing, extra, duplicates, tooManyLevel2)
}
