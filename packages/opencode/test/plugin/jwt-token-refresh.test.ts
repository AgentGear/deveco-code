import { afterEach, describe, expect, mock, setSystemTime, test } from "bun:test"
import { Global } from "@opencode-ai/core/global"
import { LocalCrypto } from "@/security/local-crypto"
import {
  __resetTokenRefreshState,
  DevEcoAuthPlugin,
  devecoAuth,
  ensureValidToken,
} from "@/plugin/deveco"
import { loginService } from "@/plugin/deveco/login-service"
import { tokenStorage } from "@/plugin/deveco/token-storage"
import { tmpdir } from "../fixture/fixture"

const originalDataDir = Global.Path.data
const originalDevecoRefresh = devecoAuth.refreshToken
const originalLoginRefresh = loginService.refreshToken
const originalLoadToken = tokenStorage.loadToken
const originalUserInfo = (loginService as any).userInfo

type RefreshResult = { accessToken: string; refreshToken: string } | null
type AuthState = { type: string; access: string; refresh: string; expires: number }

function authPath() {
  return `${Global.Path.data}/auth.json`
}

async function seedAuth(deveco: Record<string, unknown>) {
  const encrypted = LocalCrypto.encryptAuthData({ deveco })
  await Bun.write(authPath(), JSON.stringify(encrypted, null, 2))
}

async function readAuth(): Promise<AuthState> {
  const raw = JSON.parse(await Bun.file(authPath()).text())
  const data = LocalCrypto.decryptAuthData(raw) as Record<string, unknown>
  return data.deveco as AuthState
}

/** Mock devecoAuth.refreshToken (used by ensureValidToken → doRefreshToken). */
function mockDevecoRefresh(impl: () => Promise<RefreshResult>) {
  const fn = mock(impl)
  devecoAuth.refreshToken = fn as typeof originalDevecoRefresh
  return fn
}

/** Mock loginService.refreshToken(jwtToken) — the actual HTTP refresh call. */
function mockLoginRefresh(impl: (jwtToken: string) => Promise<RefreshResult>) {
  const fn = mock(impl)
  loginService.refreshToken = fn as typeof originalLoginRefresh
  return fn
}

/** Mock tokenStorage.loadToken() — reads jwtToken from token.enc on disk. */
function mockLoadToken(impl: () => Promise<string | null>) {
  const fn = mock(impl)
  tokenStorage.loadToken = fn as typeof originalLoadToken
  return fn
}

afterEach(() => {
  Global.Path.data = originalDataDir
  devecoAuth.refreshToken = originalDevecoRefresh
  loginService.refreshToken = originalLoginRefresh
  tokenStorage.loadToken = originalLoadToken
  ;(loginService as any).userInfo = originalUserInfo
  __resetTokenRefreshState()
  mock.restore()
  setSystemTime()
})

describe("DevEcoAuth.refreshToken — 使用 jwtToken 刷新 accessToken", () => {
  test("从内存 userInfo 获取 jwtToken 并成功刷新", async () => {
    const spy = mockLoginRefresh(async (_jwt) => ({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    }))
    ;(loginService as any).userInfo = {
      userId: "u1",
      userName: "test",
      accessToken: "old-access",
      refreshToken: "old-refresh",
      jwtToken: "jwt-from-memory",
      countryCode: "CN",
      language: "zh_CN",
      isRealName: false,
    }

    const result = await devecoAuth.refreshToken()

    expect(result).toEqual({ accessToken: "new-access", refreshToken: "new-refresh" })
    expect(spy.mock.calls).toHaveLength(1)
    expect(spy.mock.calls[0][0]).toBe("jwt-from-memory")
    expect((loginService as any).userInfo.accessToken).toBe("new-access")
    expect((loginService as any).userInfo.refreshToken).toBe("new-refresh")
    ;(loginService as any).userInfo = null
  })

  test("内存无 userInfo 时从磁盘 token.enc 加载 jwtToken 并刷新", async () => {
    mockLoadToken(async () => "jwt-from-disk")
    const spy = mockLoginRefresh(async (_jwt) => ({
      accessToken: "disk-refreshed",
      refreshToken: "disk-refresh-new",
    }))
    ;(loginService as any).userInfo = null

    const result = await devecoAuth.refreshToken()

    expect(result).toEqual({ accessToken: "disk-refreshed", refreshToken: "disk-refresh-new" })
    expect(spy.mock.calls[0][0]).toBe("jwt-from-disk")
  })

  test("内存和磁盘均无 jwtToken 时返回 null", async () => {
    mockLoadToken(async () => null)
    const spy = mockLoginRefresh(async () => ({ accessToken: "x", refreshToken: "y" }))
    ;(loginService as any).userInfo = null

    const result = await devecoAuth.refreshToken()

    expect(result).toBeNull()
    expect(spy.mock.calls).toHaveLength(0)
  })

  test("loginService.refreshToken 返回 null 时整体返回 null", async () => {
    mockLoadToken(async () => "valid-jwt")
    mockLoginRefresh(async () => null)
    ;(loginService as any).userInfo = null

    const result = await devecoAuth.refreshToken()

    expect(result).toBeNull()
  })

  test("刷新成功后更新内存中 userInfo 的 accessToken 和 refreshToken", async () => {
    mockLoginRefresh(async () => ({ accessToken: "updated-access", refreshToken: "updated-refresh" }))
    ;(loginService as any).userInfo = {
      userId: "u1",
      userName: "test",
      accessToken: "old",
      refreshToken: "old-r",
      jwtToken: "jwt",
      countryCode: "CN",
      language: "zh_CN",
      isRealName: false,
    }

    await devecoAuth.refreshToken()

    expect((loginService as any).userInfo.accessToken).toBe("updated-access")
    expect((loginService as any).userInfo.refreshToken).toBe("updated-refresh")
    ;(loginService as any).userInfo = null
  })

  test("磁盘有 jwtToken 但刷新 API 失败时返回 null，userInfo 不变", async () => {
    mockLoadToken(async () => "valid-jwt")
    mockLoginRefresh(async () => null)
    ;(loginService as any).userInfo = null

    const result = await devecoAuth.refreshToken()

    expect(result).toBeNull()
  })
})

describe("ensureValidToken — accessToken 过期时通过 jwtToken 刷新", () => {
  test("未过期直接返回，不调用 refresh", async () => {
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    const spy = mockDevecoRefresh(async () => null)

    await seedAuth({ type: "oauth", access: "valid-token", refresh: "r", expires: Date.now() + 60_000 })

    expect(await ensureValidToken()).toBe("valid-token")
    expect(spy.mock.calls).toHaveLength(0)
  })

  test("过期后调用 jwtToken 刷新，返回新 token 并持久化到磁盘", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    mockDevecoRefresh(async () => ({ accessToken: "refreshed-access", refreshToken: "refreshed-token" }))

    await seedAuth({ type: "oauth", access: "expired", refresh: "r", expires: 1 })

    expect(await ensureValidToken()).toBe("refreshed-access")

    const deveco = await readAuth()
    expect(deveco.access).toBe("refreshed-access")
    expect(deveco.refresh).toBe("refreshed-token")
    expect(deveco.expires).toBeGreaterThan(1_000_000)
  })

  test("刷新失败返回 null，仅调用一次 refresh", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    const spy = mockDevecoRefresh(async () => null)

    await seedAuth({ type: "oauth", access: "old", refresh: "r", expires: 1 })

    expect(await ensureValidToken()).toBeNull()
    expect(spy.mock.calls).toHaveLength(1)
  })

  test("jwtToken 不可用导致 refresh 返回 null", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    const spy = mockDevecoRefresh(async () => null)

    await seedAuth({ type: "oauth", access: "old", refresh: "r", expires: 1 })

    expect(await ensureValidToken()).toBeNull()
    expect(spy.mock.calls).toHaveLength(1)
  })

  test("refresh 返回空 accessToken 时视为失败，不持久化到磁盘", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    mockDevecoRefresh(async () => ({ accessToken: "", refreshToken: "new-refresh" }))

    await seedAuth({ type: "oauth", access: "old", refresh: "r", expires: 1 })

    expect(await ensureValidToken()).toBeNull()

    // 空 accessToken 不应被写入 auth.json，磁盘上应保持原样
    const deveco = await readAuth()
    expect(deveco.access).toBe("old")
    expect(deveco.expires).toBe(1)
  })

  test("并发调用共享同一次 refresh 请求（dedup）", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    const spy = mockDevecoRefresh(
      () =>
        new Promise<RefreshResult>((resolve) => {
          setTimeout(() => resolve({ accessToken: "new", refreshToken: "new-r" }), 50)
        }),
    )

    await seedAuth({ type: "oauth", access: "old", refresh: "r", expires: 1 })

    const [a, b, c] = await Promise.all([ensureValidToken(), ensureValidToken(), ensureValidToken()])

    expect(a).toBe("new")
    expect(b).toBe("new")
    expect(c).toBe("new")
    expect(spy.mock.calls).toHaveLength(1)
  })

  test("失败后 cooldown 期内跳过 refresh，cooldown 后重试", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    const spy = mockDevecoRefresh(async () => null)

    await seedAuth({ type: "oauth", access: "old", refresh: "r", expires: 1 })

    // 第一次：触发 refresh，失败
    expect(await ensureValidToken()).toBeNull()
    expect(spy.mock.calls).toHaveLength(1)

    // cooldown 期内（29s < 30s）：跳过 refresh
    setSystemTime(1_000_000 + 29_000)
    expect(await ensureValidToken()).toBeNull()
    expect(spy.mock.calls).toHaveLength(1)

    // cooldown 后（31s > 30s）：重新尝试 refresh
    setSystemTime(1_000_000 + 31_000)
    expect(await ensureValidToken()).toBeNull()
    expect(spy.mock.calls).toHaveLength(2)
  })

  test("auth.json 不存在时直接返回 null", async () => {
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    const spy = mockDevecoRefresh(async () => ({ accessToken: "x", refreshToken: "y" }))

    expect(await ensureValidToken()).toBeNull()
    expect(spy.mock.calls).toHaveLength(0)
  })
})

describe("auth-plugin fetch interceptor — jwtToken 刷新后请求处理", () => {
  test("token 过期 → 刷新成功 → 使用新 Bearer token 发送请求", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    mockDevecoRefresh(async () => ({ accessToken: "new-access-token", refreshToken: "new-refresh" }))

    await seedAuth({ type: "oauth", access: "expired", refresh: "r", expires: 1 })

    const authState = { type: "oauth" as const, access: "expired", refresh: "r", expires: 1 }
    const plugin = await DevEcoAuthPlugin({} as any)
    const authLoader = plugin.auth!
    const { fetch: fetchFn } = await authLoader.loader!(async () => authState, {} as any)

    const captured = new Promise<RequestInit>((resolve) => {
      globalThis.fetch = mock(async (_url: any, init: any) => {
        resolve(init)
        return new Response("ok")
      }) as any
    })

    await fetchFn!("https://api.example.com/v1/chat", {
      method: "POST",
      headers: { authorization: "Bearer expired", "content-type": "application/json" },
      body: JSON.stringify({ stream: true }),
    })

    const init = await captured
    const headers = init!.headers as Headers
    expect(headers.get("authorization")).toBe("Bearer new-access-token")
  })

  test("token 过期 → 刷新失败 → 返回 401 Response，不发送请求", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    mockDevecoRefresh(async () => null)

    await seedAuth({ type: "oauth", access: "expired", refresh: "r", expires: 1 })

    const authState = { type: "oauth" as const, access: "expired", refresh: "r", expires: 1 }
    const plugin = await DevEcoAuthPlugin({} as any)
    const authLoader = plugin.auth!
    const { fetch: fetchFn } = await authLoader.loader!(async () => authState, {} as any)

    const fetchMock = mock(async () => new Response("should not be called"))
    globalThis.fetch = fetchMock as any

    const response = await fetchFn!("https://api.example.com/v1/chat", {
      method: "POST",
      headers: { authorization: "Bearer expired" },
      body: JSON.stringify({ stream: true }),
    })

    expect(response.status).toBe(401)
    expect(fetchMock.mock.calls).toHaveLength(0)

    const body = await response.json()
    expect(body.error).toContain("Token refresh failed")
  })

  test("token 未过期 → 直接使用现有 Bearer token", async () => {
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    const refreshSpy = mockDevecoRefresh(async () => ({ accessToken: "should-not-use", refreshToken: "x" }))

    await seedAuth({ type: "oauth", access: "still-valid", refresh: "r", expires: Date.now() + 60_000 })

    const authState = { type: "oauth" as const, access: "still-valid", refresh: "r", expires: Date.now() + 60_000 }
    const plugin = await DevEcoAuthPlugin({} as any)
    const authLoader = plugin.auth!
    const { fetch: fetchFn } = await authLoader.loader!(async () => authState, {} as any)

    const captured = new Promise<RequestInit>((resolve) => {
      globalThis.fetch = mock(async (_url: any, init: any) => {
        resolve(init)
        return new Response("ok")
      }) as any
    })

    await fetchFn!("https://api.example.com/v1/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stream: true }),
    })

    const init = await captured
    const headers = init!.headers as Headers
    expect(headers.get("authorization")).toBe("Bearer still-valid")
    expect(refreshSpy.mock.calls).toHaveLength(0)
  })

  test("刷新成功后同时设置 lang 和 Chat-Id 等必要 headers", async () => {
    setSystemTime(1_000_000)
    await using tmp = await tmpdir()
    Global.Path.data = tmp.path
    mockDevecoRefresh(async () => ({ accessToken: "refreshed", refreshToken: "r" }))

    await seedAuth({ type: "oauth", access: "expired", refresh: "r", expires: 1 })

    const authState = { type: "oauth" as const, access: "expired", refresh: "r", expires: 1 }
    const plugin = await DevEcoAuthPlugin({} as any)
    const authLoader = plugin.auth!
    const { fetch: fetchFn } = await authLoader.loader!(async () => authState, {} as any)

    const captured = new Promise<RequestInit>((resolve) => {
      globalThis.fetch = mock(async (_url: any, init: any) => {
        resolve(init)
        return new Response("ok")
      }) as any
    })

    await fetchFn!("https://api.example.com/v1/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stream: true }),
    })

    const init = await captured
    const headers = init!.headers as Headers
    expect(headers.get("authorization")).toBe("Bearer refreshed")
    expect(headers.get("lang")).toBe("en")
    expect(headers.get("Chat-Id")).toBeTruthy()
  })
})
