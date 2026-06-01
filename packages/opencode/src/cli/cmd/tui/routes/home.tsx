import { Prompt, type PromptRef } from "@tui/component/prompt"
import { createEffect, createMemo, createSignal, Match, on, onMount, Show, Switch } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/context/theme"
import {
  Banner,
  BANNER_HOME_CONTENT_INSET,
  HOME_BODY_GAP_ROWS,
  HOME_BODY_MAX_ROWS,
  HOME_CONTENT_MAX_WIDTH,
  homeBodySlotRows,
} from "../component/banner"
import { pluralize } from "@/util/locale"
import { useSync } from "../context/sync"
import { useKV } from "../context/kv"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useRouteData } from "@tui/context/route"
import { usePromptRef } from "../context/prompt"
import { useLocal } from "../context/local"
import { DevEcoOnboarding } from "../component/deveco-onboarding"
import { TuiPluginRuntime } from "@/cli/cmd/tui/plugin/runtime"
import { agreementService } from "@/cli/deveco-agreement"
import { devecoAuth, hasDevecoOAuthEntry } from "@/plugin/deveco"
import type { AgreementConfig } from "@/cli/deveco-legal"

declare const DEVECO_SKIP_AGREEMENT: boolean | undefined

// TODO: what is the best way to do this?
let once = false

const placeholder = {
  normal: ["Fix a TODO in the codebase", "What is the tech stack of this project?", "Fix broken tests"],
  shell: ["ls -la", "git status", "pwd"],
}

export function Home() {
  const sync = useSync()
  const kv = useKV()
  const { theme } = useTheme()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const dimensions = useTerminalDimensions()

  // DevEco onboarding state - null = checking, false = show onboarding, true = ready
  const [devecoReady, setDevecoReady] = createSignal<boolean | null>(null)
  const [devecoInitialStep, setDevecoInitialStep] = createSignal<"entry" | "privacy">("entry")
  // Cached auth check result — used to defer devecoReady=true until sync completes
  // (the Prompt component needs sync data to render properly)
  const [authCanEnter, setAuthCanEnter] = createSignal(false)
  // Track whether the auth check itself has finished (distinct from sync progress)
  const [authCheckDone, setAuthCheckDone] = createSignal(false)
  let devecoChecked = false

  const bodySlotHeight = createMemo(() => homeBodySlotRows(dimensions().height))

  // Check login + agreement status immediately on mount (no sync dependency).
  // The auth check reads auth.json and calls the TMS API — it does not
  // need sync data.  For canEnter=false (not logged in / agreement pending),
  // set devecoReady=false right away so the user sees the login/agreement page
  // without waiting.  For canEnter=true, defer devecoReady=true until sync
  // completes because the Prompt component requires sync data.
  //
  // When built with --skip-agreement, the agreement check is skipped;
  // login is still required, but after login the user enters the
  // conversation page directly without the privacy/agreement step.
  const runDevecoCheck = async () => {
    if (devecoChecked) return
    devecoChecked = true

    // First, check auth.json for a deveco OAuth entry — this is the same
    // data source that `deveco auth list` reads.  If auth.json has no entry,
    // the user has not completed the DevEco login flow, regardless of whether
    // token.enc or an in-memory userInfo exists.
    if (!hasDevecoOAuthEntry()) {
      setDevecoInitialStep("entry")
      setDevecoReady(false)
      setAuthCheckDone(true)
      return
    }

    // auth.json has a deveco entry — read the persisted OAuth tokens
    const session = await devecoAuth.getSession()

    // Session should not be null since auth.json has an entry, but guard anyway
    if (!session) {
      setDevecoInitialStep("entry")
      setDevecoReady(false)
      setAuthCheckDone(true)
      return
    }

    // Use accessToken from session (populated from auth.json or userInfo)
    let accessToken = session.accessToken
    if (!accessToken) {
      // accessToken missing → try refresh via JWT token check API
      const newTokens = await devecoAuth.refreshToken()
      if (newTokens?.accessToken) {
        accessToken = newTokens.accessToken
      } else {
        // Refresh failed → login state expired, need to re-login
        setDevecoInitialStep("entry")
        setDevecoReady(false)
        setAuthCheckDone(true)
        return
      }
    }

    // Build-time flag or runtime env: skip agreement query and sign check, enter conversation directly
    if (
      (typeof DEVECO_SKIP_AGREEMENT !== "undefined" && DEVECO_SKIP_AGREEMENT) ||
      process.env.DEVECO_SKIP_AGREEMENT === "1"
    ) {
      setAuthCanEnter(true)
      setAuthCheckDone(true)
      if (sync.status === "complete") {
        setDevecoReady(true)
      }
      return
    }

    // Remote query agreement signing status
    // Inject project-level agreement config overrides before making API calls
    agreementService.configure(sync.data.config.agreement as AgreementConfig | undefined)
    const checkResult = await agreementService.checkAllAgreements(accessToken, kv)

    if (checkResult.canEnter) {
      // Logged in + agreements compliant → cache result, apply when sync completes
      setAuthCanEnter(true)
      setAuthCheckDone(true)
      if (sync.status === "complete") {
        // Sync already done → apply immediately
        setDevecoReady(true)
      }
    } else {
      // Logged in but agreements not compliant or network error → show privacy step immediately
      setDevecoInitialStep("privacy")
      setDevecoReady(false)
      setAuthCheckDone(true)
    }
  }

  // Run auth check immediately on mount — don't wait for sync
  onMount(() => {
    void runDevecoCheck()
  })

  // When sync completes, apply the deferred auth check result.
  // Tracks both sync.status and authCanEnter so it fires correctly
  // regardless of which signal changes last.
  createEffect(() => {
    if (sync.status === "complete" && authCanEnter()) {
      setDevecoReady(true)
    }
  })

  const mcpError = createMemo(() => {
    return Object.values(sync.data.mcp).some((x) => x.status === "failed")
  })

  const connectedMcpCount = createMemo(() => {
    return Object.values(sync.data.mcp).filter((x) => x.status === "connected").length
  })

  const Hint = (
    <Show when={connectedMcpCount() > 0}>
      <box flexShrink={0} flexDirection="row" gap={1}>
        <text fg={theme.text}>
          <Switch>
            <Match when={mcpError()}>
              <span style={{ fg: theme.error }}>•</span> mcp errors{" "}
              <span style={{ fg: theme.textMuted }}>ctrl+x s</span>
            </Match>
            <Match when={true}>
              <span style={{ fg: theme.success }}>•</span>{" "}
              {pluralize(connectedMcpCount(), "{} mcp server", "{} mcp servers")}
            </Match>
          </Switch>
        </text>
      </box>
    </Show>
  )

  let prompt: PromptRef | undefined
  const args = useArgs()
  const local = useLocal()
  onMount(() => {
    if (once) return
    if (!prompt) return
    if (route.prompt) {
      prompt.set(route.prompt)
      once = true
    } else if (args.prompt) {
      prompt.set({ input: args.prompt, parts: [] })
      once = true
    }
  })

  // Wait for sync and model store to be ready before auto-submitting --prompt
  createEffect(
    on(
      () => sync.ready && local.model.ready && prompt,
      (ready) => {
        if (!ready) return
        if (!args.prompt) return
        if (!prompt) return
        if (prompt.current?.input !== args.prompt) return
        prompt.submit()
      },
    ),
  )

  return (
    <>
      <box flexGrow={1} flexDirection="column" minHeight={0}>
        <box
          flexGrow={1}
          minHeight={0}
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
        >
          <box
            flexDirection="column"
            alignItems="center"
            width="100%"
            maxWidth={HOME_CONTENT_MAX_WIDTH}
            flexShrink={0}
            position="relative"
          >
            <box zIndex={0} flexShrink={0} width="100%" alignItems="center">
              <TuiPluginRuntime.Slot name="home_logo" mode="replace">
                <Banner contentInset={BANNER_HOME_CONTENT_INSET} />
              </TuiPluginRuntime.Slot>
            </box>
            <box
              zIndex={1}
              position="relative"
              width="100%"
              height={bodySlotHeight()}
              maxHeight={HOME_BODY_MAX_ROWS}
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
              paddingTop={HOME_BODY_GAP_ROWS}
              flexShrink={0}
            >
              <Show when={!authCheckDone()}>
                <text fg={theme.textMuted} selectable={false}>
                  Checking login status...
                </text>
              </Show>
              <Show when={authCheckDone() && authCanEnter() && devecoReady() !== true}>
                <box flexDirection="column" alignItems="center">
                  <text fg={theme.textMuted} selectable={false}>
                    Loading project data...
                  </text>
                  <text fg={theme.textMuted} selectable={false}>
                    providers, MCP servers, LSP, sessions...
                  </text>
                </box>
              </Show>
              <Show when={devecoReady()}>
                <box width="100%" flexDirection="column" alignItems="center" flexShrink={0}>
                  <box width="100%" flexShrink={0}>
                    <TuiPluginRuntime.Slot name="home_prompt" mode="replace">
                      <Prompt
                        ref={(r) => {
                          if (r) {
                            prompt = r
                            promptRef.set(r)
                          }
                        }}
                        hint={Hint}
                        placeholders={placeholder}
                        homeBodySlotHeight={bodySlotHeight()}
                      />
                    </TuiPluginRuntime.Slot>
                  </box>
                  <TuiPluginRuntime.Slot name="home_bottom" />
                </box>
              </Show>
              <Show when={devecoReady() === false}>
                <DevEcoOnboarding
                  onComplete={() => setDevecoReady(true)}
                  bodySlotHeight={bodySlotHeight()}
                  initialStep={devecoInitialStep()}
                />
              </Show>
            </box>
          </box>
        </box>
        <Toast />
      </box>
      <box width="100%" flexShrink={0}>
        <TuiPluginRuntime.Slot name="home_footer" mode="single_winner" />
      </box>
    </>
  )
}
