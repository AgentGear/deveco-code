// Ripgrep utility functions
import path from "path"
import { fileURLToPath } from "url"
import { Global } from "../global"
import fs from "fs/promises"
import z from "zod"
import { NamedError } from "@opencode-ai/util/error"

import { Filesystem } from "../util/filesystem"
import { Process } from "../util/process"
import { which } from "../util/which"
import { Log } from "@/util/log"

export namespace Ripgrep {
  const log = Log.create({ service: "ripgrep" })
  const Stats = z.object({
    elapsed: z.object({
      secs: z.number(),
      nanos: z.number(),
      human: z.string(),
    }),
    searches: z.number(),
    searches_with_match: z.number(),
    bytes_searched: z.number(),
    bytes_printed: z.number(),
    matched_lines: z.number(),
    matches: z.number(),
  })

  const Begin = z.object({
    type: z.literal("begin"),
    data: z.object({
      path: z.object({
        text: z.string(),
      }),
    }),
  })

  export const Match = z.object({
    type: z.literal("match"),
    data: z.object({
      path: z.object({
        text: z.string(),
      }),
      lines: z.object({
        text: z.string(),
      }),
      line_number: z.number(),
      absolute_offset: z.number(),
      submatches: z.array(
        z.object({
          match: z.object({
            text: z.string(),
          }),
          start: z.number(),
          end: z.number(),
        }),
      ),
    }),
  })

  const End = z.object({
    type: z.literal("end"),
    data: z.object({
      path: z.object({
        text: z.string(),
      }),
      binary_offset: z.number().nullable(),
      stats: Stats,
    }),
  })

  const Summary = z.object({
    type: z.literal("summary"),
    data: z.object({
      elapsed_total: z.object({
        human: z.string(),
        nanos: z.number(),
        secs: z.number(),
      }),
      stats: Stats,
    }),
  })

  const Result = z.union([Begin, Match, End, Summary])

  export type Result = z.infer<typeof Result>
  export type Match = z.infer<typeof Match>
  export type Begin = z.infer<typeof Begin>
  export type End = z.infer<typeof End>
  export type Summary = z.infer<typeof Summary>

  const state = (async () => {
    // 1. Check system PATH for rg
    const system = which("rg")
    if (system) {
      const stat = await fs.stat(system).catch(() => undefined)
      if (stat?.isFile()) return { filepath: system }
      log.warn("bun.which returned invalid rg path", { filepath: system })
    }

    // 2. Check vendor directory relative to binary (production / npm mode)
    //    Layout: <package>/bin/codegenie, <package>/vendor/ripgrep/rg
    const binaryName = process.platform === "win32" ? "rg.exe" : "rg"
    const execDir = path.dirname(process.execPath)
    const vendorRg = path.join(execDir, "..", "vendor", "ripgrep", binaryName)
    if (await Filesystem.exists(vendorRg)) return { filepath: vendorRg }

    // 3. Check next to the compiled binary (legacy / standalone mode)
    const execRg = path.join(execDir, binaryName)
    if (await Filesystem.exists(execRg)) return { filepath: execRg }

    // 4. Fallback to cache directory
    const cacheRg = path.join(Global.Path.bin, binaryName)
    if (await Filesystem.exists(cacheRg)) return { filepath: cacheRg }

    // 5. Dev mode: check .build-cache/rg/ relative to source
    const devRg = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..", "..",
      ".build-cache", "ripgrep",
      `${process.platform}-${process.arch}`,
      binaryName,
    )
    if (await Filesystem.exists(devRg)) return { filepath: devRg }

    throw new Error(
      `ripgrep binary not found. Searched: system PATH, ${vendorRg}, ${execRg}, ${cacheRg}, ${devRg}`,
    )
  })()

  export async function filepath() {
    const { filepath } = await state
    return filepath
  }

  export async function* files(input: {
    cwd: string
    glob?: string[]
    hidden?: boolean
    follow?: boolean
    maxDepth?: number
    signal?: AbortSignal
  }) {
    input.signal?.throwIfAborted()

    const args = [await filepath(), "--files", "--glob=!.git/*"]
    if (input.follow) args.push("--follow")
    if (input.hidden !== false) args.push("--hidden")
    if (input.maxDepth !== undefined) args.push(`--max-depth=${input.maxDepth}`)
    if (input.glob) {
      for (const g of input.glob) {
        args.push(`--glob=${g}`)
      }
    }

    // Guard against invalid cwd to provide a consistent ENOENT error.
    if (!(await fs.stat(input.cwd).catch(() => undefined))?.isDirectory()) {
      throw Object.assign(new Error(`No such file or directory: '${input.cwd}'`), {
        code: "ENOENT",
        errno: -2,
        path: input.cwd,
      })
    }

    const proc = Process.spawn(args, {
      cwd: input.cwd,
      stdout: "pipe",
      stderr: "ignore",
      abort: input.signal,
    })

    if (!proc.stdout) {
      throw new Error("Process output not available")
    }

    let buffer = ""
    const stream = proc.stdout as AsyncIterable<Buffer | string>
    for await (const chunk of stream) {
      input.signal?.throwIfAborted()

      buffer += typeof chunk === "string" ? chunk : chunk.toString()
      // Handle both Unix (\n) and Windows (\r\n) line endings
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line) yield line
      }
    }

    if (buffer) yield buffer
    await proc.exited

    input.signal?.throwIfAborted()
  }

  export async function tree(input: { cwd: string; limit?: number; signal?: AbortSignal }) {
    log.info("tree", input)
    const files = await Array.fromAsync(Ripgrep.files({ cwd: input.cwd, signal: input.signal }))
    interface Node {
      name: string
      children: Map<string, Node>
    }

    function dir(node: Node, name: string) {
      const existing = node.children.get(name)
      if (existing) return existing
      const next = { name, children: new Map() }
      node.children.set(name, next)
      return next
    }

    const root: Node = { name: "", children: new Map() }
    for (const file of files) {
      if (file.includes(".codegenie")) continue
      const parts = file.split(path.sep)
      if (parts.length < 2) continue
      let node = root
      for (const part of parts.slice(0, -1)) {
        node = dir(node, part)
      }
    }

    function count(node: Node): number {
      let total = 0
      for (const child of node.children.values()) {
        total += 1 + count(child)
      }
      return total
    }

    const total = count(root)
    const limit = input.limit ?? total
    const lines: string[] = []
    const queue: { node: Node; path: string }[] = []
    for (const child of Array.from(root.children.values()).sort((a, b) => a.name.localeCompare(b.name))) {
      queue.push({ node: child, path: child.name })
    }

    let used = 0
    for (let i = 0; i < queue.length && used < limit; i++) {
      const { node, path } = queue[i]
      lines.push(path)
      used++
      for (const child of Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name))) {
        queue.push({ node: child, path: `${path}/${child.name}` })
      }
    }

    if (total > used) lines.push(`[${total - used} truncated]`)

    return lines.join("\n")
  }

  export async function search(input: {
    cwd: string
    pattern: string
    glob?: string[]
    limit?: number
    follow?: boolean
  }) {
    const args = [`${await filepath()}`, "--json", "--hidden", "--glob=!.git/*"]
    if (input.follow) args.push("--follow")

    if (input.glob) {
      for (const g of input.glob) {
        args.push(`--glob=${g}`)
      }
    }

    if (input.limit) {
      args.push(`--max-count=${input.limit}`)
    }

    args.push("--")
    args.push(input.pattern)

    const result = await Process.text(args, {
      cwd: input.cwd,
      nothrow: true,
    })
    if (result.code !== 0) {
      return []
    }

    // Handle both Unix (\n) and Windows (\r\n) line endings
    const lines = result.text.trim().split(/\r?\n/).filter(Boolean)
    // Parse JSON lines from ripgrep output

    return lines
      .map((line) => JSON.parse(line))
      .map((parsed) => Result.parse(parsed))
      .filter((r) => r.type === "match")
      .map((r) => r.data)
  }
}
