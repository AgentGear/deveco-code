import { afterEach, describe, expect, mock, setSystemTime, test } from "bun:test"
import { Global } from "@opencode-ai/core/global"
import { LocalCrypto } from "@/security/local-crypto"
import { __resetTokenRefreshState, devecoAuth, ensureValidToken, saveAuthToDisk } from "@/plugin/deveco"
import { tmpdir } from "../fixture/fixture"

const originalDataDir = Global.Path.data
const originalRefresh = devecoAuth.refreshToken

type RefreshResult = { accessToken: string; refreshToken: string } | null

function authPath() {
  return `${Global.Path.data}/auth.json`
}

async function seedAuth(deveco: Record<string, unknown>) {
  const encrypted = LocalCrypto.encryptAuthData({ deveco })
  await Bun.write(authPath(), JSON.stringify(encrypted, null, 2))
}

async function readAuth(): Promise<Record<string, unknown>> {
  const raw = JSON.parse(await Bun.file(authPath()).text())
  return LocalCrypto.decryptAuthData(raw) as Record<string, unknown>
}

/** Replace devecoAuth.refreshToken with a counting mock; restored in afterEach. */
function mockRefresh(impl: () => Promise<RefreshResult>) {
  const fn = mock(impl)
  devecoAuth.refreshToken = fn as typeof originalRefresh
  return fn
}

afterEach(() => {
  Global.Path.data = originalDataDir
  devecoAuth.refreshToken = originalRefresh
  __resetTokenRefreshState()
  mock.restore()
  setSystemTime()
})

describe("saveAuthToDisk", () => {
  test("persists deveco entry and reads back decrypted", async () => {
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path

    await saveAuthToDisk("deveco", { type: "oauth", access: "abc", refresh: "xyz", expires: 100 })

    const deveco = (await readAuth()).deveco as { access: string; refresh: string }
    expect(deveco.access).toBe("abc")
    expect(deveco.refresh).toBe("xyz")
  })

  test("leaves no .tmp file after atomic write", async () => {
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path

    await saveAuthToDisk("deveco", { type: "oauth", access: "abc", refresh: "", expires: 0 })

    expect(await Bun.file(authPath()).exists()).toBe(true)
    expect(await Bun.file(`${authPath()}.tmp`).exists()).toBe(false)
  })

  test("preserves other provider keys", async () => {
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path

    await saveAuthToDisk("other", { type: "api", key: "k" })
    await saveAuthToDisk("deveco", { type: "oauth", access: "abc", refresh: "", expires: 0 })

    const data = await readAuth()
    expect((data.other as { key: string }).key).toBe("k")
    expect((data.deveco as { access: string }).access).toBe("abc")
  })

  test("creates parent directory when missing", async () => {
    await using tmp = await tmpdir()
    Global.Path.data = `${tmp.path}/nested/missing`

    await saveAuthToDisk("deveco", { type: "oauth", access: "abc", refresh: "", expires: 0 })

    expect(await Bun.file(authPath()).exists()).toBe(true)
  })
})

describe("ensureValidToken", () => {
  test("returns disk token when not expired without refreshing", async () => {
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    const spy = mockRefresh(() => Promise.resolve(null))

    await seedAuth({ type: "oauth", access: "valid", refresh: "r", expires: Date.now() + 10_000 })

    expect(await ensureValidToken()).toBe("valid")
    expect(spy.mock.calls).toHaveLength(0)
  })

  test("refreshes and persists when token is expired", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    mockRefresh(() => Promise.resolve({ accessToken: "new-access", refreshToken: "new-refresh" }))

    await seedAuth({ type: "oauth", access: "old", refresh: "r", expires: 1 })

    expect(await ensureValidToken()).toBe("new-access")
    const deveco = (await readAuth()).deveco as { access: string; refresh: string; expires: number }
    expect(deveco.access).toBe("new-access")
    expect(deveco.refresh).toBe("new-refresh")
    expect(deveco.expires).toBeGreaterThan(1_000_000)
  })

  test("returns null when refresh fails and records exactly one call", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    const spy = mockRefresh(() => Promise.resolve(null))

    await seedAuth({ type: "oauth", access: "old", refresh: "r", expires: 1 })

    expect(await ensureValidToken()).toBeNull()
    expect(spy.mock.calls).toHaveLength(1)
  })

  test("concurrent callers share a single refresh call", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    const spy = mockRefresh(
      () => new Promise<RefreshResult>((resolve) => {
        setTimeout(() => resolve({ accessToken: "new-access", refreshToken: "new-refresh" }), 50)
      }),
    )

    await seedAuth({ type: "oauth", access: "old", refresh: "r", expires: 1 })

    const [a, b, c] = await Promise.all([ensureValidToken(), ensureValidToken(), ensureValidToken()])

    expect(a).toBe("new-access")
    expect(b).toBe("new-access")
    expect(c).toBe("new-access")
    expect(spy.mock.calls).toHaveLength(1)
  })

  test("short-circuits refresh within cooldown then recovers after it", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    const spy = mockRefresh(() => Promise.resolve(null))

    await seedAuth({ type: "oauth", access: "old", refresh: "r", expires: 1 })

    expect(await ensureValidToken()).toBeNull()
    expect(spy.mock.calls).toHaveLength(1)

    setSystemTime(1_000_000 + 29_000)
    expect(await ensureValidToken()).toBeNull()
    expect(spy.mock.calls).toHaveLength(1)

    setSystemTime(1_000_000 + 31_000)
    expect(await ensureValidToken()).toBeNull()
    expect(spy.mock.calls).toHaveLength(2)
  })
})
