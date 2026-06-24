/**
 * Register DevEco-specific extensions into the generic TUI package.
 *
 * Must be called once before the TUI root renders. Call site:
 *   packages/opencode/src/plugin/tui/runtime.ts → createLegacyTuiPluginHost()
 *
 * This decouples the TUI package from `deveco` (breaks the cyclic dependency)
 * by injecting implementations rather than importing them directly.
 */
import { registerDevEcoExtensions } from "@opencode-ai/tui/deveco-extensions"
import { DevEcoHomeBody } from "./home-body"
import { DialogPrivacy } from "./dialog-privacy"
import { openComplainPage } from "./complain"
import { Auth } from "@/auth"
import { LOCAL_CREDENTIALS_CORRUPTED_MESSAGE } from "@/auth/messages"
import { Effect } from "effect"

async function readLocalAuthError(): Promise<string | undefined> {
  try {
    await Effect.runPromise(
      Effect.gen(function* () {
        const auth = yield* Auth.Service
        yield* auth.all()
      }).pipe(Effect.provide(Auth.defaultLayer)) as Effect.Effect<void>,
    )
    return undefined
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes(LOCAL_CREDENTIALS_CORRUPTED_MESSAGE)) return LOCAL_CREDENTIALS_CORRUPTED_MESSAGE
    throw error
  }
}

/**
 * Minimal pluralize — matches the signature of @opencode-ai/tui/util/locale's pluralize.
 * Duplicated here so the TUI can delegate to DevEco without re-importing its own locale util
 * (which would not close the cycle; this is a defensive copy).
 */
function pluralize(count: number, singular: string, plural: string): string {
  const template = count === 1 ? singular : plural
  return template.replace("{}", String(count))
}

export function registerDevEcoTuiExtensions(): void {
  registerDevEcoExtensions({
    homeBody: DevEcoHomeBody,
    readLocalAuthError,
    openComplainPage,
    pluralize,
    privacyDialog: DialogPrivacy,
  })
}
