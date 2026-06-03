import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { devecoAuth } from "@/plugin/deveco"

const TARGET_URL = "https://css-complain-drcn.platform.dbankcloud.cn/?next=1&theme=light&lang=zh-cn"
const PROFILE_DIR = join(tmpdir(), "deveco-complain-chrome-profile")

type OpenComplainResult = { ok: true } | { ok: false; message: string }

export async function openComplainPage(latestConversation = ""): Promise<OpenComplainResult> {
  const chrome = findChrome()
  if (!chrome) {
    return {
      ok: false,
      message: "当前页面仅支持使用 Google Chrome 打开。请安装 Chrome 后重试；如已安装在非默认路径，可通过环境变量 CHROME_PATH 指定 Chrome 可执行文件。",
    }
  }

  const payload = await createComplainPayload(latestConversation)

  try {
    await openWithChrome(chrome, payload)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function findChrome() {
  const configured = process.env.CHROME_PATH
  if (configured) return existsSync(configured) ? configured : undefined

  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          join(homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        ]
      : process.platform === "win32"
        ? [
            join(process.env.PROGRAMFILES ?? "", "Google/Chrome/Application/chrome.exe"),
            join(process.env["PROGRAMFILES(X86)"] ?? "", "Google/Chrome/Application/chrome.exe"),
            join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/snap/bin/chromium",
          ]

  return candidates.find((candidate) => candidate && existsSync(candidate))
}

async function createComplainPayload(latestConversation: string) {
  const session = await devecoAuth.getSession().catch(() => null)
  return {
    accessToken: session?.accessToken ?? "",
    additionalContext: {
      dialogCard1: latestConversation,
    },
    appId: "5006203948",
    deviceId: "270086000122081382",
    disableUserUpload: false,
    sceneId: "7",
    subSceneId: "20",
    theme: {
      backgroundColorNight: "#202224",
      backgroundColorLight: "#f1f3f5",
    },
  }
}

async function openWithChrome(chromePath: string, complainData: unknown) {
  const existingPort = await findExistingDevtoolsPort(PROFILE_DIR)
  const port = existingPort ?? (await launchChrome(chromePath, PROFILE_DIR))
  const webSocketDebuggerUrl = await createPageWebSocket(port)
  const cdp = await connectDevtools(webSocketDebuggerUrl)

  try {
    await openComplainTarget(cdp, complainData)
  } finally {
    const timer = setTimeout(() => cdp.close(), 5_000)
    if (typeof timer.unref === "function") timer.unref()
  }
}

async function launchChrome(chromePath: string, profileDir: string) {
  const chrome = spawn(
    chromePath,
    [
      `--user-data-dir=${profileDir}`,
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
      "--new-window",
      "about:blank",
    ],
    {
      detached: true,
      stdio: "ignore",
    },
  )

  const chromeFailed = new Promise<never>((_, reject) => {
    chrome.once("error", (error) => reject(error))
    chrome.once("exit", (code, signal) => {
      const status = signal ?? `code ${code ?? "unknown"}`
      reject(new Error(`Chrome exited before DevTools became ready (${status}).`))
    })
  })

  chrome.unref()

  return Promise.race([waitForDevtoolsPort(profileDir), chromeFailed])
}

async function openComplainTarget(cdp: Awaited<ReturnType<typeof connectDevtools>>, complainData: unknown) {
  await cdp.send("Page.enable")
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: complainBridgeSource(complainData),
  })
  const domContentLoaded = cdp.waitForEvent("Page.domContentEventFired", 15_000)
  await cdp.send("Page.navigate", { url: TARGET_URL })
  await domContentLoaded
  const verification = await verifyBridge(cdp)
  if (!verification.injected || !verification.hasBridge) {
    throw new Error("Complain page bridge injection failed.")
  }
}

function complainBridgeSource(complainData: unknown) {
  const payload = JSON.stringify(complainData)
  return `
(() => {
  const complainPayload = ${payload};

  const bridge = {
    complainAddInfo(callback) {
      const value = JSON.stringify(complainPayload);

      if (callback) {
        callback(value);
      }

      return value;
    },
  };

  Object.defineProperty(window, "complainJSInterface", {
    configurable: true,
    enumerable: true,
    get() {
      return bridge;
    }
  });

  window.__complainBridgeInjected = true;
  console.info("[complain bridge] injected");
})();
`
}

async function waitForDevtoolsPort(profileDir: string) {
  const file = join(profileDir, "DevToolsActivePort")
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const port = readDevtoolsPort(profileDir)
    if (port !== undefined) return port
    await delay(50)
  }
  throw new Error("Chrome DevTools endpoint did not become ready.")
}

async function findExistingDevtoolsPort(profileDir: string) {
  const port = readDevtoolsPort(profileDir)
  if (port === undefined) return undefined

  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`)
    if (!response.ok) return undefined
    return port
  } catch {
    return undefined
  }
}

function readDevtoolsPort(profileDir: string) {
  const file = join(profileDir, "DevToolsActivePort")
  if (!existsSync(file)) return undefined

  const [port] = readFileSync(file, "utf8").split("\n")
  const parsed = Number.parseInt(port, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

async function createPageWebSocket(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: "PUT",
  })
  if (response.ok) {
    const page = (await response.json()) as { webSocketDebuggerUrl?: string }
    if (page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
  }

  throw new Error("Chrome page target did not become ready.")
}

function connectDevtools(webSocketDebuggerUrl: string) {
  let nextID = 1
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  const listeners = new Map<string, Set<(params: unknown) => void>>()
  const ws = new WebSocket(webSocketDebuggerUrl)

  ws.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return
    const message = JSON.parse(event.data) as {
      id?: number
      method?: string
      params?: unknown
      result?: unknown
      error?: { message?: string }
    }
    if (message.method) {
      const items = listeners.get(message.method)
      if (items) {
        for (const item of items) item(message.params)
      }
    }
    if (message.id === undefined) return
    const item = pending.get(message.id)
    if (!item) return
    pending.delete(message.id)
    if (message.error) {
      item.reject(new Error(message.error.message ?? "Chrome DevTools command failed."))
      return
    }
    item.resolve(message.result)
  })

  ws.addEventListener("error", () => {
    for (const item of pending.values()) item.reject(new Error("Chrome DevTools websocket failed."))
    pending.clear()
  })

  const opened = new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true })
    ws.addEventListener("error", () => reject(new Error("Chrome DevTools websocket failed.")), { once: true })
  })

  return {
    async send(method: string, params?: Record<string, unknown>) {
      await opened
      const id = nextID++
      const result = new Promise<unknown>((resolve, reject) => {
        pending.set(id, { resolve, reject })
      })
      ws.send(JSON.stringify({ id, method, params }))
      return result
    },
    close() {
      ws.close()
    },
    waitForEvent(method: string, timeout: number) {
      return new Promise<unknown>((resolve, reject) => {
        const items = listeners.get(method) ?? new Set<(params: unknown) => void>()
        listeners.set(method, items)

        const timer = setTimeout(() => {
          items.delete(done)
          reject(new Error(`Timed out waiting for Chrome DevTools event ${method}.`))
        }, timeout)

        const done = (params: unknown) => {
          clearTimeout(timer)
          items.delete(done)
          resolve(params)
        }

        items.add(done)
      })
    },
  }
}

async function verifyBridge(cdp: Awaited<ReturnType<typeof connectDevtools>>) {
  const result = (await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const bridge = window.complainJSInterface;
      return {
        injected: window.__complainBridgeInjected === true,
        hasBridge: typeof bridge?.complainAddInfo === "function",
        bridgeValue: typeof bridge?.complainAddInfo === "function" ? bridge.complainAddInfo() : undefined,
      };
    })()`,
    returnByValue: true,
  })) as { result?: { value?: { injected?: boolean; hasBridge?: boolean; bridgeValue?: string } } }

  return {
    injected: result.result?.value?.injected === true,
    hasBridge: result.result?.value?.hasBridge === true,
    bridgeValue: result.result?.value?.bridgeValue,
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
