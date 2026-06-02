import fs from "fs"
import path from "path"
import { Glob } from "@opencode-ai/core/util/glob"

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

interface ModuleFact {
  name: string
  root: string
  moduleType?: string
  mainElement?: string
  moduleJson?: string
  abilities: Array<{ name?: string; srcEntry?: string }>
}

interface CodeFact {
  path: string
  exportedSymbols: string[]
  components: string[]
  entryComponents: string[]
  loadContentTargets: string[]
  stateObjects: string[]
}

interface PriorityModule {
  module: string
  files: string[]
  chain?: string
}

function rel(filePath: string, root: string) {
  return path.relative(root, filePath).split(path.sep).join("/")
}

function readText(filePath: string) {
  return fs.readFileSync(filePath, "utf8")
}

function stripJson5Comments(text: string) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

function quoteUnquotedKeys(text: string) {
  return text.replace(/([{\[,]\s*)([A-Za-z_][\w-]*)(\s*:)/g, '$1"$2"$3')
}

function removeTrailingCommas(text: string) {
  return text.replace(/,\s*([}\]])/g, "$1")
}

function parseJson5Like(filePath: string): JsonValue {
  const text = removeTrailingCommas(quoteUnquotedKeys(stripJson5Comments(readText(filePath)))).replace(/'/g, '"')
  return JSON.parse(text) as JsonValue
}

function asObject(value: JsonValue | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as Record<string, JsonValue>
}

function asArray(value: JsonValue | undefined) {
  return Array.isArray(value) ? value : []
}

function exists(filePath: string) {
  try {
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

function isHarmonyProject(projectRoot: string) {
  return (
    exists(path.join(projectRoot, "AppScope", "app.json5")) ||
    (exists(path.join(projectRoot, "build-profile.json5")) &&
      (exists(path.join(projectRoot, "oh-package.json5")) || exists(path.join(projectRoot, "oh-package.json"))))
  )
}

function discoverModuleRoots(projectRoot: string) {
  const roots = new Map<string, string>()
  const buildProfile = path.join(projectRoot, "build-profile.json5")
  if (exists(buildProfile)) {
    const data = asObject(parseJson5Like(buildProfile))
    for (const item of asArray(data?.modules)) {
      const module = asObject(item)
      const name = module?.name
      const srcPath = module?.srcPath
      if (typeof name === "string" && typeof srcPath === "string") {
        roots.set(name, path.resolve(projectRoot, srcPath))
      }
    }
  }

  for (const moduleJson of Glob.scanSync("**/src/main/module.json5", {
    cwd: projectRoot,
    absolute: true,
    dot: true,
    symlink: true,
  })) {
    try {
      const data = asObject(parseJson5Like(moduleJson))
      const module = asObject(data?.module)
      const name = module?.name
      if (typeof name !== "string") continue
      const moduleRoot = path.resolve(moduleJson, "..", "..", "..")
      roots.set(name, moduleRoot)
    } catch {
      continue
    }
  }

  return roots
}

function scanModules(projectRoot: string) {
  const modules = new Map<string, ModuleFact>()
  for (const [name, moduleRoot] of discoverModuleRoots(projectRoot)) {
    const moduleJson = path.join(moduleRoot, "src", "main", "module.json5")
    const fact: ModuleFact = { name, root: rel(moduleRoot, projectRoot), abilities: [] }
    if (!exists(moduleJson)) {
      modules.set(name, fact)
      continue
    }

    const data = asObject(parseJson5Like(moduleJson))
    const module = asObject(data?.module)
    fact.moduleJson = rel(moduleJson, projectRoot)
    fact.moduleType = typeof module?.type === "string" ? module.type : undefined
    fact.mainElement = typeof module?.mainElement === "string" ? module.mainElement : undefined
    fact.abilities = asArray(module?.abilities)
      .map((item) => asObject(item))
      .filter((item): item is { name?: string; srcEntry?: string } => !!item)
      .map((item) => ({
        name: typeof item.name === "string" ? item.name : undefined,
        srcEntry: typeof item.srcEntry === "string" ? item.srcEntry : undefined,
      }))
    modules.set(name, fact)
  }
  return modules
}

function extractExportedSymbols(text: string) {
  const patterns = [
    /export\s+(?:default\s+)?class\s+(\w+)/g,
    /export\s+struct\s+(\w+)/g,
    /export\s+function\s+(\w+)/g,
    /export\s+enum\s+(\w+)/g,
    /export\s+interface\s+(\w+)/g,
  ]
  const symbols = new Set<string>()
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) symbols.add(match[1])
    }
  }
  return [...symbols]
}

function extractComponents(text: string) {
  const components = new Set<string>()
  const entryComponents = new Set<string>()
  const pattern = /(@Entry\s*)?@Component(?:\([^)]*\))?\s*(?:export\s+)?struct\s+(\w+)/gs
  for (const match of text.matchAll(pattern)) {
    if (!match[2]) continue
    components.add(match[2])
    if (match[1]) entryComponents.add(match[2])
  }
  return { components: [...components], entryComponents: [...entryComponents] }
}

function extractStateObjects(text: string) {
  const suffixes = "(?:ViewModel|VM|Store|Controller|Presenter|Model|State)"
  const patterns = [
    new RegExp(`\\bnew\\s+([A-Z]\\w*${suffixes})\\s*\\(`, "g"),
    new RegExp(`\\b([A-Z]\\w*${suffixes})\\.getInstance\\s*\\(`, "g"),
  ]
  const symbols = new Set<string>()
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) symbols.add(match[1])
    }
  }
  return [...symbols]
}

function scanEtsFiles(projectRoot: string) {
  const facts = new Map<string, CodeFact>()
  for (const filePath of Glob.scanSync("**/*.ets", {
    cwd: projectRoot,
    absolute: true,
    dot: true,
    symlink: true,
  })) {
    const normalized = filePath.replace(/\\/g, "/")
    if (normalized.includes("/ohosTest/") || normalized.includes("/src/test/") || normalized.includes("/.preview/")) {
      continue
    }

    const text = readText(filePath)
    const { components, entryComponents } = extractComponents(text)
    const fact: CodeFact = {
      path: rel(filePath, projectRoot),
      exportedSymbols: extractExportedSymbols(text),
      components,
      entryComponents,
      loadContentTargets: [...text.matchAll(/\.loadContent\s*\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]),
      stateObjects: extractStateObjects(text),
    }

    if (
      fact.exportedSymbols.length ||
      fact.components.length ||
      fact.entryComponents.length ||
      fact.loadContentTargets.length ||
      fact.stateObjects.length
    ) {
      facts.set(fact.path, fact)
    }
  }
  return facts
}

function resolveModuleSrcEntry(moduleJson: string, srcEntry: string) {
  const base = path.dirname(moduleJson)
  const candidate = path.resolve(base, srcEntry)
  if (exists(candidate)) return candidate
  if (srcEntry.startsWith("./")) {
    const trimmed = path.resolve(base, srcEntry.slice(2))
    if (exists(trimmed)) return trimmed
  }
  return candidate
}

function resolveLoadContent(moduleRoot: string, target: string) {
  const targetPath = target.endsWith(".ets") ? target.slice(0, -4) : target
  const candidates = [
    path.join(moduleRoot, "src", "main", "ets", `${targetPath}.ets`),
    path.join(moduleRoot, "src", "main", "ets", targetPath),
  ]
  return candidates.find((candidate) => exists(candidate))
}

function commonPathPrefixLen(left: string, right: string) {
  const leftParts = left.split("/")
  const rightParts = right.split("/")
  let count = 0
  for (let index = 0; index < Math.min(leftParts.length, rightParts.length); index++) {
    if (leftParts[index] !== rightParts[index]) break
    count++
  }
  return count
}

function findStateObjectFile(codeFacts: Map<string, CodeFact>, stateObject: string, sourcePath?: string) {
  const candidates = [...codeFacts.entries()]
    .filter(
      ([, fact]) =>
        fact.exportedSymbols.includes(stateObject) ||
        fact.components.includes(stateObject) ||
        fact.entryComponents.includes(stateObject),
    )
    .map(([filePath]) => filePath)
  if (!candidates.length) return undefined
  if (!sourcePath) return candidates[0]
  return candidates.reduce((best, candidate) =>
    commonPathPrefixLen(sourcePath, candidate) > commonPathPrefixLen(sourcePath, best) ? candidate : best,
  )
}

function uniqueKeepOrder(items: Array<string | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    if (!item || seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

function projectPriorityConfigs(projectRoot: string) {
  return uniqueKeepOrder([
    exists(path.join(projectRoot, "build-profile.json5")) ? rel(path.join(projectRoot, "build-profile.json5"), projectRoot) : undefined,
    exists(path.join(projectRoot, "AppScope", "app.json5")) ? rel(path.join(projectRoot, "AppScope", "app.json5"), projectRoot) : undefined,
    exists(path.join(projectRoot, "oh-package.json5")) ? rel(path.join(projectRoot, "oh-package.json5"), projectRoot) : undefined,
  ])
}

function routeStartupEntryFlow(projectRoot: string, modules: Map<string, ModuleFact>, codeFacts: Map<string, CodeFact>) {
  const priorityModules: PriorityModule[] = []

  for (const module of modules.values()) {
    if (module.moduleType !== "entry" || !module.mainElement || !module.moduleJson) continue

    const priorityFiles: string[] = [module.moduleJson]
    let abilitySource: string | undefined
    let firstPage: string | undefined
    let firstPageSource: string | undefined

    for (const ability of module.abilities) {
      if (ability.name !== module.mainElement || !ability.srcEntry) continue
      const abilityPath = resolveModuleSrcEntry(path.join(projectRoot, module.moduleJson), ability.srcEntry)
      abilitySource = rel(abilityPath, projectRoot)
      priorityFiles.push(abilitySource)
      break
    }

    if (abilitySource) {
      const abilityFact = codeFacts.get(abilitySource)
      if (abilityFact?.loadContentTargets[0]) {
        firstPage = abilityFact.loadContentTargets[0]
        const firstPagePath = resolveLoadContent(path.join(projectRoot, module.root), firstPage)
        if (firstPagePath) {
          firstPageSource = rel(firstPagePath, projectRoot)
          priorityFiles.push(firstPageSource)
        }
      }
    }

    if (firstPageSource) {
      const firstPageFact = codeFacts.get(firstPageSource)
      for (const stateObject of firstPageFact?.stateObjects ?? []) {
        const stateObjectFile = findStateObjectFile(codeFacts, stateObject, firstPageSource)
        if (stateObjectFile) priorityFiles.push(stateObjectFile)
      }
    }

    const chain = [
      module.moduleJson,
      abilitySource,
      firstPage ? `loadContent(${firstPage})` : undefined,
      firstPageSource,
    ]
      .filter(Boolean)
      .join(" -> ")

    priorityModules.push({
      module: module.name,
      files: uniqueKeepOrder(priorityFiles),
      chain: chain || undefined,
    })
  }

  return priorityModules
}

function formatExploreContext(projectRoot: string, priorityModules: PriorityModule[]) {
  if (!priorityModules.length) return undefined

  const lines = [
    "Task routing:",
    "- The section below lists project-specific priority files and startup chains from static configuration analysis.",
    "- Treat those files as the highest-priority cold-start context for startup, entry, launch-page, routing, and module-structure questions.",
    "- Start by reading the listed priority files in order before broad `glob`, `grep`, or directory traversal.",
    "- Use the startup chain to understand cross-file relationships such as `module.json5 -> EntryAbility -> loadContent(page) -> page source`.",
    "- If the task is unrelated to the listed routes, or the priority files are not enough, continue with normal search tools.",
    "",
    "# Task Routing",
    "",
    "This section is generated from static HarmonyOS project analysis. Use it to reduce cold-start blind search.",
    "",
    `Base path: ${projectRoot}`,
    "",
    "Before broad directory traversal or keyword guessing, read the priority files below when the task involves app startup, entry configuration, launch pages, or module structure.",
    "",
  ]

  const projectConfigs = projectPriorityConfigs(projectRoot)
  if (projectConfigs.length) {
    lines.push("## Project configuration", "Priority files:")
    for (const file of projectConfigs) lines.push(`- ${file}`)
    lines.push("")
  }

  for (const item of priorityModules) {
    lines.push(`## startup_entry_flow (${item.module})`)
    if (item.chain) lines.push(`Startup chain: ${item.chain}`)
    lines.push("Priority files:")
    for (const file of item.files) lines.push(`- ${file}`)
    lines.push("")
  }

  lines.push(
    "Search guidance:",
    "- Prefer `read` on the listed priority files before `glob` or `grep` when they match the task.",
    "- If the priority files are insufficient, continue with normal search tools.",
  )

  return lines.join("\n")
}

export function buildExploreContext(projectRoot: string) {
  const resolved = path.resolve(projectRoot)
  if (!isHarmonyProject(resolved)) return undefined

  const modules = scanModules(resolved)
  const codeFacts = scanEtsFiles(resolved)
  const priorityModules = routeStartupEntryFlow(resolved, modules, codeFacts)
  return formatExploreContext(resolved, priorityModules)
}
