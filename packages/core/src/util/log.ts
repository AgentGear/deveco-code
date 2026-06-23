export * as Log from "./log"

export type Level = "DEBUG" | "INFO" | "WARN" | "ERROR"

export type Logger = {
  debug(message?: any, extra?: Record<string, any>): void
  info(message?: any, extra?: Record<string, any>): void
  error(message?: any, extra?: Record<string, any>): void
  warn(message?: any, extra?: Record<string, any>): void
  tag(key: string, value: string): Logger
  clone(): Logger
  time(
    message: string,
    extra?: Record<string, any>,
  ): {
    stop(): void
    [Symbol.dispose](): void
  }
}

let level: Level = "INFO"

const levelPriority: Record<Level, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
}

function shouldLog(input: Level): boolean {
  return levelPriority[input] >= levelPriority[level]
}

const loggers = new Map<string, Logger>()

let last = Date.now()

function formatError(error: Error, depth = 0): string {
  const result = error.message
  return error.cause instanceof Error && depth < 10
    ? result + " Caused by: " + formatError(error.cause, depth + 1)
    : result
}

export function create(tags?: Record<string, any>) {
  tags = tags || {}

  const service = tags["service"]
  if (service && typeof service === "string") {
    const cached = loggers.get(service)
    if (cached) return cached
  }

  function build(message: any, extra?: Record<string, any>) {
    const prefix = Object.entries({ ...tags, ...extra })
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        const p = `${key}=`
        if (value instanceof Error) return p + formatError(value)
        if (typeof value === "object") return p + JSON.stringify(value)
        return p + value
      })
      .join(" ")
    const next = new Date()
    const diff = next.getTime() - last
    last = next.getTime()
    return [next.toISOString().split(".")[0], "+" + diff + "ms", prefix, message].filter(Boolean).join(" ") + "\n"
  }

  const result: Logger = {
    debug(message?: any, extra?: Record<string, any>) {
      if (shouldLog("DEBUG")) process.stderr.write("DEBUG " + build(message, extra))
    },
    info(message?: any, extra?: Record<string, any>) {
      if (shouldLog("INFO")) process.stderr.write("INFO  " + build(message, extra))
    },
    error(message?: any, extra?: Record<string, any>) {
      if (shouldLog("ERROR")) process.stderr.write("ERROR " + build(message, extra))
    },
    warn(message?: any, extra?: Record<string, any>) {
      if (shouldLog("WARN")) process.stderr.write("WARN  " + build(message, extra))
    },
    tag(key: string, value: string) {
      if (tags) tags[key] = value
      return result
    },
    clone() {
      return create({ ...tags })
    },
    time(message: string, extra?: Record<string, any>) {
      const now = Date.now()
      result.info(message, { status: "started", ...extra })
      function stop() {
        result.info(message, { status: "completed", duration: Date.now() - now, ...extra })
      }
      return { stop, [Symbol.dispose]() { stop() } }
    },
  }

  if (service && typeof service === "string") loggers.set(service, result)
  return result
}

export const Default = create({ service: "default" })

export interface Options {
  print: boolean
  dev?: boolean
  level?: Level
}

let logpath = ""
export function file() {
  return logpath
}
export function getLevel(): Level {
  return level
}
export async function init(options: Options) {
  if (options.level) level = options.level
}
