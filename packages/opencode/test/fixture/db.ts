import { rm } from "fs/promises"
import { disposeAllInstances } from "../../src/project/instance-runtime"
import { Database } from "@/storage/db"

export async function resetDatabase() {
  await disposeAllInstances().catch(() => undefined)
  Database.close()
  const dbPath = Database.getPath()
  await rm(dbPath, { force: true }).catch(() => undefined)
  await rm(`${dbPath}-wal`, { force: true }).catch(() => undefined)
  await rm(`${dbPath}-shm`, { force: true }).catch(() => undefined)
}
