import http, { IncomingMessage, ServerResponse } from "http"
import { URL } from "url"
import { Effect } from "effect"

async function log(effect: Effect.Effect<void>) {
  const { AppRuntime } = await import("@/effect/app-runtime")
  return AppRuntime.runPromise(effect)
}
import { LoginCancelledError, UnsupportedRegionError } from "./errors"
import type { CallbackData } from "./types"

export class LocalAuthServer {
  private server: http.Server | null = null
  private port: number
  private clientSecret: string
  private callbackPath: string = "/callback"
  private resolveCallback: ((value: CallbackData) => void) | null = null
  private rejectCallback: ((reason: Error) => void) | null = null
  private timeoutId: ReturnType<typeof setTimeout> | null = null

  constructor(
    port: number,
    clientSecret: string,
    private baseUrl: string,
    private successRedirectUrl: string,
    private failedRedirectUrl: string,
  ) {
    this.port = port
    this.clientSecret = clientSecret
  }

  public async start(): Promise<number> {
    const portsToTry = [this.port, 34567, 34568, 34569, 34570]

    for (const port of portsToTry) {
      try {
        const actualPort = await this.tryPort(port)
        this.port = actualPort
        return actualPort
      } catch {
        if (port === portsToTry[portsToTry.length - 1]) {
          await log(Effect.logError("all auth server ports are in use", { service: "deveco", ports: portsToTry }))
          throw new Error("All ports are in use. Please free up a port or close other DevEco Code instances.")
        }
      }
    }

    throw new Error("Failed to start server")
  }

  private tryPort(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this.handleRequest(req, res)
      })
      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          reject(new Error("Port is already in use"))
        } else {
          reject(err)
        }
      })
      server.listen(port, "127.0.0.1", () => {
        this.server = server
        resolve(port)
      })
    })
  }

  public async waitForCallback(timeout: number = 30000): Promise<CallbackData> {
    return new Promise((resolve, reject) => {
      this.resolveCallback = (value: CallbackData) => {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId)
          this.timeoutId = null
        }
        resolve(value)
      }
      this.rejectCallback = (reason: Error) => {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId)
          this.timeoutId = null
        }
        reject(reason)
      }
      this.timeoutId = setTimeout(() => {
        this.timeoutId = null
        this.rejectCallback?.(new Error("Callback timeout"))
      }, timeout)
    })
  }

  public cancel(): void {
    if (this.rejectCallback) {
      this.rejectCallback(new LoginCancelledError("Login cancelled by user"))
      this.rejectCallback = null
      this.resolveCallback = null
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  public async stop(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve()
        return
      }
      this.server.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const host = req.headers.host || `localhost:${this.port}`
    const url = new URL(req.url ?? "", `http://${host}`)

    if (url.pathname !== this.callbackPath) {
      res.writeHead(404)
      res.end("Not Found")
      return
    }

    try {
      const urlParams = url.searchParams

      if (req.method === "POST") {
        let body = ""
        req.on("data", (chunk) => {
          body += chunk.toString()
        })
        req.on("end", () => {
          this.handleCallbackRequest(req, res, urlParams, body)
        })
      } else {
        this.handleCallbackRequest(req, res, urlParams, "")
      }
    } catch (err) {
      res.writeHead(500)
      res.end("Internal Server Error")
      void log(Effect.logError("local auth server request error", { service: "deveco", error: err instanceof Error ? err.message : String(err) }))
      this.rejectCallback?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  private handleCallbackRequest(
    _req: IncomingMessage,
    res: ServerResponse,
    urlParams: URLSearchParams,
    body: string,
  ): void {
    try {
      let params: URLSearchParams
      if (body && body.trim()) {
        params = new URLSearchParams(body)
      } else {
        params = urlParams
      }

      const code = params.get("code")
      const tempToken = params.get("tempToken")
      const siteId = params.get("siteId")
      const quit = params.get("quit")

      if (!code || code !== this.clientSecret) {
        void log(Effect.logWarning("login callback: code mismatch or missing, ignoring", { service: "deveco", hasCode: !!code }))
        return
      }

      if (quit === "true" || quit === "access_denied") {
        void log(Effect.logInfo("login callback: user cancelled", { service: "deveco", quit }))
        this.rejectCallback?.(
          new LoginCancelledError(quit === "access_denied" ? "Access denied by user" : "Login cancelled by user"),
        )
        res.writeHead(302, {
          Location: `${this.baseUrl}/${this.failedRedirectUrl}`,
        })
        res.end()
        return
      }

      if (!tempToken || !siteId) {
        void log(Effect.logError("login callback: missing tempToken or siteId", { service: "deveco", tempToken: !!tempToken, siteId: !!siteId }))
        this.rejectCallback?.(new Error("Login cancelled by user"))
        res.writeHead(302, {
          Location: `${this.baseUrl}/${this.failedRedirectUrl}`,
        })
        res.end()
        return
      }

      if (siteId !== "1") {
        void log(Effect.logError("login callback: unsupported region", { service: "deveco", siteId }))
        this.rejectCallback?.(new UnsupportedRegionError("Unsupported region"))
        res.writeHead(302, {
          Location: `${this.baseUrl}/${this.failedRedirectUrl}`,
        })
        res.end()
        return
      }

      const callbackData: CallbackData = {
        tempToken,
        siteId,
        quit: quit ?? undefined,
      }

      this.resolveCallback?.(callbackData)

      res.writeHead(302, {
        Location: `${this.baseUrl}/${this.successRedirectUrl}`,
      })
      res.end()
    } catch (err) {
      res.writeHead(500)
      res.end("Internal Server Error")
      void log(Effect.logError("local auth server callback error", { service: "deveco", error: err instanceof Error ? err.message : String(err) }))
      this.rejectCallback?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  public getPort(): number {
    return this.port
  }
}
