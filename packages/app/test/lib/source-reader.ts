import fs from "fs"
import path from "path"

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..")

export function readSource(relPath: string): string {
  const abs = path.join(REPO_ROOT, relPath)
  if (!fs.existsSync(abs)) return ""
  return fs.readFileSync(abs, "utf-8")
}

export function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, relPath))
}
