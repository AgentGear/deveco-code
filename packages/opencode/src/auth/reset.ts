import fs from "fs/promises"
import path from "path"
import { Global } from "@opencode-ai/core/global"

export type ResetLocalCredentialsResult = {
  removed: string[]
  failed: Array<{ path: string; message: string }>
}

export function localCredentialsResetPaths() {
  return {
    auth: path.join(Global.Path.data, "auth.json"),
    tokenDek: path.join(Global.Path.config, "token.dek"),
    tokenEnc: path.join(Global.Path.config, "token.enc"),
    keys: path.join(Global.Path.config, "keys"),
  }
}

export async function resetLocalCredentials(): Promise<ResetLocalCredentialsResult> {
  const paths = localCredentialsResetPaths()
  const result: ResetLocalCredentialsResult = {
    removed: [],
    failed: [],
  }

  await removeFile(paths.auth, result)
  await removeFile(paths.tokenDek, result)
  await removeFile(paths.tokenEnc, result)

  const keys = await fs.readdir(paths.keys).catch((error) => {
    if (isNotFound(error)) return [] as string[]
    result.failed.push({ path: paths.keys, message: errorMessage(error) })
    return [] as string[]
  })
  await Promise.all(
    keys.filter((file) => file.endsWith(".bin")).map((file) => removeFile(path.join(paths.keys, file), result)),
  )

  return result
}

async function removeFile(file: string, result: ResetLocalCredentialsResult) {
  try {
    await fs.rm(file, { force: true })
    result.removed.push(file)
  } catch (error) {
    result.failed.push({ path: file, message: errorMessage(error) })
  }
}

function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}
