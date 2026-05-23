import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Global } from "@opencode-ai/core/global"
import { resetLocalCredentials } from "../../src/auth/reset"

async function withGlobalPaths<T>(fn: () => Promise<T>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-local-credentials-"))
  const previous = {
    config: Global.Path.config,
    data: Global.Path.data,
  }
  Global.Path.config = path.join(root, "config")
  Global.Path.data = path.join(root, "data")
  await fs.mkdir(Global.Path.config, { recursive: true })
  await fs.mkdir(Global.Path.data, { recursive: true })
  try {
    return await fn()
  } finally {
    Global.Path.config = previous.config
    Global.Path.data = previous.data
    await fs.rm(root, { recursive: true, force: true })
  }
}

describe("local credentials corruption", () => {
  test("resetLocalCredentials removes auth storage and key material", async () =>
    withGlobalPaths(async () => {
      await fs.mkdir(path.join(Global.Path.config, "keys"), { recursive: true })
      await fs.writeFile(path.join(Global.Path.data, "auth.json"), "{}")
      await fs.writeFile(path.join(Global.Path.config, "token.dek"), "{}")
      await fs.writeFile(path.join(Global.Path.config, "token.enc"), "{}")
      await fs.writeFile(path.join(Global.Path.config, "keys", "kek-v1.bin"), "key")
      await fs.writeFile(path.join(Global.Path.config, "keys", "keep.txt"), "keep")

      const result = await resetLocalCredentials()

      expect(result.failed).toEqual([])
      await expect(fs.stat(path.join(Global.Path.data, "auth.json"))).rejects.toThrow()
      await expect(fs.stat(path.join(Global.Path.config, "token.dek"))).rejects.toThrow()
      await expect(fs.stat(path.join(Global.Path.config, "token.enc"))).rejects.toThrow()
      await expect(fs.stat(path.join(Global.Path.config, "keys", "kek-v1.bin"))).rejects.toThrow()
      expect(await fs.readFile(path.join(Global.Path.config, "keys", "keep.txt"), "utf8")).toBe("keep")
    }))
})
