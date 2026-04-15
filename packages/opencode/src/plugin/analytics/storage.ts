import fs from "fs/promises"
import path from "path"
import os from "os"
import { randomUUID } from "crypto"

const ANALYTICS_DIR = ".codegenie"
const ANALYTICS_FILE = "analytics.json"
const UID_FILE = "uid"

interface AnalyticsStorage {
  uid: string
  pendingEvents: unknown[]
  lastFlush: number
}

function getAnalyticsDir(): string {
  return path.join(os.homedir(), ANALYTICS_DIR)
}

function getAnalyticsFilePath(): string {
  return path.join(getAnalyticsDir(), ANALYTICS_FILE)
}

function getUidFilePath(): string {
  return path.join(getAnalyticsDir(), UID_FILE)
}

async function ensureDir(): Promise<void> {
  const dir = getAnalyticsDir()
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {
    // ignore
  }
}

export async function getOrCreateUid(): Promise<string> {
  const uidPath = getUidFilePath()
  try {
    const uid = await fs.readFile(uidPath, "utf-8")
    if (uid && uid.trim()) return uid.trim()
  } catch {
    // file not exists
  }
  await ensureDir()
  const newUid = randomUUID()
  await fs.writeFile(uidPath, newUid, "utf-8")
  return newUid
}

export async function loadStorage(): Promise<AnalyticsStorage> {
  const filePath = getAnalyticsFilePath()
  try {
    const content = await fs.readFile(filePath, "utf-8")
    return JSON.parse(content)
  } catch {
    return {
      uid: await getOrCreateUid(),
      pendingEvents: [],
      lastFlush: Date.now(),
    }
  }
}

export async function saveStorage(storage: AnalyticsStorage): Promise<void> {
  await ensureDir()
  const filePath = getAnalyticsFilePath()
  await fs.writeFile(filePath, JSON.stringify(storage, null, 2), "utf-8")
}

export async function appendPendingEvent(event: unknown): Promise<void> {
  const storage = await loadStorage()
  storage.pendingEvents.push(event)
  await saveStorage(storage)
}

export async function clearPendingEvents(): Promise<void> {
  const storage = await loadStorage()
  storage.pendingEvents = []
  storage.lastFlush = Date.now()
  await saveStorage(storage)
}

export async function getPendingEvents(): Promise<unknown[]> {
  const storage = await loadStorage()
  return storage.pendingEvents
}

export function getUserid(): string {
  return process.env.CODEGENIE_USER_ID || process.env.USER || "unknown"
}

export function getOsName(): string {
  return process.platform
}

export function getOsVersion(): string {
  return os.release()
}

export async function getVersion(): Promise<string> {
  try {
    const pkgPath = path.join(process.cwd(), "package.json")
    const content = await fs.readFile(pkgPath, "utf-8")
    const pkg = JSON.parse(content)
    return pkg.version || "0.0.0"
  } catch {
    return "0.0.0"
  }
}
