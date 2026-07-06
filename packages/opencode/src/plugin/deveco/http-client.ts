import http from "http"
import https from "https"
import { URL } from "url"
import type { HttpRequestConfig, HttpResponse, TokenCheckResponse } from "./types"

export class HttpClient {
  private defaultTimeout: number = 20000
  private defaultHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "accept-language": "zh-CN",
  }

  public async get(url: string, config?: HttpRequestConfig): Promise<HttpResponse> {
    return this.request(url, "GET", config)
  }

  public async post(url: string, config?: HttpRequestConfig): Promise<HttpResponse> {
    return this.request(url, "POST", config)
  }

  private async request(url: string, method: string, config?: HttpRequestConfig): Promise<HttpResponse> {
    const parsedUrl = new URL(url)
    const isHttps = parsedUrl.protocol === "https:"
    const httpModule = isHttps ? https : http

    const searchParams = new URLSearchParams(config?.params ?? {})
    const queryString = searchParams.toString()
    const fullUrl = queryString ? `${url}?${queryString}` : url

    const headers = {
      ...this.defaultHeaders,
      ...(config?.headers || {}),
    }

    return new Promise((resolve, reject) => {
      const options: http.RequestOptions | https.RequestOptions = {
        method,
        headers,
        timeout: config?.timeout ?? this.defaultTimeout,
      }

      const req = httpModule.request(fullUrl, options, (res) => {
        let data = ""
        res.on("data", (chunk) => {
          data += chunk
        })
        res.on("end", () => {
          resolve({
            data,
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
          })
        })
      })

      req.on("error", reject)
      req.on("timeout", () => {
        req.destroy()
        reject(new Error("Request timeout"))
      })

      if (method === "POST" && config?.params) {
        req.write(JSON.stringify(config.params))
      }

      req.end()
    })
  }

  public parseJson(response: HttpResponse): TokenCheckResponse {
    const contentType = (response.headers['content-type'] ?? '').toString().toLowerCase()
    const body = response.data.trim()
    if (contentType.includes('html') || /^\s*<!doctype|^\s*<html/i.test(body)) {
      throw new Error(`Server returned HTML instead of JSON (content-type: ${contentType || 'unknown'}). The auth server may be behind a gateway or proxy error page.`)
    }
    try {
      return JSON.parse(body) as TokenCheckResponse
    } catch (err) {
      throw new Error(`Failed to parse server response as JSON: ${err instanceof Error ? err.message : String(err)}. Response preview: ${body.slice(0, 200)}`)
    }
  }
}

export const httpClient = new HttpClient()
