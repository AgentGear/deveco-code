import fs from "fs/promises"
import path from "path"
import os from "os"
import { randomUUID } from "crypto"
import { Global } from "@opencode-ai/core/global"
import { LocalCrypto } from "@/security/local-crypto"

const ANALYTICS_FILE = "analytics.json"

interface AnalyticsStorage {
  uid: string
  userid: string
  pendingEvents: unknown[]
  lastFlush: number
}

function getAnalyticsDir(): string {
  return path.join(Global.Path.data, "analytics")
}

function getAnalyticsFilePath(): string {
  return path.join(getAnalyticsDir(), ANALYTICS_FILE)
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
  const storage = await loadStorage()
  if (storage.uid.trim()) return storage.uid
  storage.uid = randomUUID()
  await saveStorage(storage)
  return storage.uid
}

function isStorageShape(value: unknown): value is AnalyticsStorage {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<AnalyticsStorage>
  return (
    typeof item.uid === "string" &&
    typeof item.userid === "string" &&
    Array.isArray(item.pendingEvents) &&
    typeof item.lastFlush === "number"
  )
}

export async function loadStorage(): Promise<AnalyticsStorage> {
  const filePath = getAnalyticsFilePath()
  try {
    const content = await fs.readFile(filePath, "utf-8")
    const encrypted = JSON.parse(content)
    if (LocalCrypto.isEncryptedBlob(encrypted)) {
      return JSON.parse(LocalCrypto.decryptForLocalStorage(encrypted))
    }
    if (isStorageShape(encrypted)) {
      if (!encrypted.userid) encrypted.userid = "unknown"
      await saveStorage(encrypted)
      return encrypted
    }
  } catch {
    // ignore
  }
  return {
    uid: randomUUID(),
    userid: "unknown",
    pendingEvents: [],
    lastFlush: Date.now(),
  }
}

export async function saveStorage(storage: AnalyticsStorage): Promise<void> {
  await ensureDir()
  const filePath = getAnalyticsFilePath()
  const encrypted = LocalCrypto.encryptForLocalStorage(JSON.stringify(storage))
  await fs.writeFile(filePath, JSON.stringify(encrypted, null, 2), "utf-8")
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

export async function saveUserid(userid: string): Promise<void> {
  const storage = await loadStorage()
  storage.userid = userid || "unknown"
  await saveStorage(storage)
}

export async function getUserid(): Promise<string> {
  const storage = await loadStorage()
  return storage.userid || "unknown"
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
