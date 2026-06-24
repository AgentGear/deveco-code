import * as prompts from "@clack/prompts"
import { Log } from "@opencode-ai/core/util/log"
import { devecoAuth } from "./auth"
import { saveAuthToDisk } from "./storage"
import { ACCESS_TOKEN_EXPIRES_MS } from "./types"

const log = Log.create({ service: "deveco" })

export async function requireLogin(): Promise<boolean> {
  if (await devecoAuth.isLoggedIn()) return true

  prompts.intro("Get started with DevEco Code")

  const choice = await prompts.select({
    message: "How would you like to continue?",
    options: [
      { label: "Login", value: "login", hint: "Sign in with your Huawei account" },
      { label: "Don't use", value: "skip", hint: "Exit DevEco Code" },
    ],
  })

  if (prompts.isCancel(choice)) {
    prompts.outro("Goodbye!")
    return false
  }

  if (choice === "skip") {
    prompts.outro("Goodbye!")
    return false
  }

  const spinner = prompts.spinner()
  spinner.start("Starting login process...")

  try {
    spinner.message("Opening browser for login...")

    const result = await devecoAuth.login()

    if (!result.success) {
      spinner.stop("Login failed")
      if (result.cancelled) {
        // 用户在浏览器登录页面取消了登录
        prompts.outro("Goodbye!")
        return false
      }
      if (result.unsupportedRegion) {
        log.error("login failed: unsupported region")
        prompts.log.error("Sorry, only China site accounts are currently supported")
      } else {
        log.error("login failed", { error: result.error })
        prompts.log.error(result.error || "An error occurred during login")
      }
      prompts.outro("Please try again later")
      return false
    }

    spinner.stop("Login successful!")
    prompts.log.success(`Logged in as ${result.userInfo?.userName}`)

    // Save tokens to Auth using oauth type with expiration
    const accessToken = result.userInfo?.accessToken || ""
    const refreshToken = result.userInfo?.refreshToken || ""
    if (accessToken) {
      await saveAuthToDisk("deveco", {
        type: "oauth",
        access: accessToken,
        refresh: refreshToken,
        expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
      })
    }

    prompts.outro("Welcome to DevEco Code!")
    return true
  } catch (error) {
    spinner.stop("Login failed")
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    log.error("login exception in requireLogin", { error: errorMessage })
    prompts.log.error(errorMessage)
    prompts.outro("Please try again later")
    return false
  }
}
