/**
 * DevEco Home body — owns the entire center slot of the TUI Home page.
 *
 * Encapsulates:
 *  1. Login check (auth.json + OAuth entry)
 *  2. Agreement check (TMS API + KV cache)
 *  3. Onboarding UI (privacy / entry / auth / provider / key)
 *  4. Prompt UI (banner + prompt) once authed + compliant
 *
 * The generic TUI Home route renders this component through
 * `getDevEcoExtensions().homeBody` — when absent, it falls back to the
 * upstream (generic) Home layout.
 */
import {
  createEffect,
  createMemo,
  createSignal,
  Match,
  on,
  onMount,
  Show,
  Switch,
} from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@opencode-ai/tui/context/theme"
import {
  Banner,
  BANNER_HOME_CONTENT_INSET,
  HOME_BODY_GAP_ROWS,
  HOME_BODY_MAX_ROWS,
  HOME_CONTENT_MAX_WIDTH,
  homeBodySlotRows,
} from "@opencode-ai/tui/component/banner"
import { useKV } from "@opencode-ai/tui/context/kv"
import { useArgs } from "@opencode-ai/tui/context/args"
import { useRouteData } from "@opencode-ai/tui/context/route"
import { usePromptRef } from "@opencode-ai/tui/context/prompt"
import { useLocal } from "@opencode-ai/tui/context/local"
import { Prompt, type PromptRef } from "@opencode-ai/tui/component/prompt"
import { usePluginRuntime } from "@opencode-ai/tui/plugin/runtime"
import { HomeSessionDestinationProvider } from "@opencode-ai/tui/routes/home/session-destination"
import { Toast } from "@opencode-ai/tui/ui/toast"
import type { SyncObject } from "@opencode-ai/tui/deveco-extensions"
import { agreementService, AgreementStatus } from "@/cli/deveco-agreement"
import { devecoAuth, hasDevecoOAuthEntry } from "@/plugin/deveco"
import type { AgreementConfig } from "@/cli/deveco-legal"
import { DevEcoOnboarding } from "./onboarding"

declare const DEVECO_SKIP_AGREEMENT: boolean | undefined

// TODO: what is the best way to do this?
let once = false

const placeholder = {
  normal: ["Fix a TODO in the codebase", "What is the tech stack of this project?", "Fix broken tests"],
  shell: ["ls -la", "git status", "pwd"],
}

export function DevEcoHomeBody(props: { sync: SyncObject; bodySlotHeight: number }) {
  const sync = props.sync
  const kv = useKV()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()

  const [devecoReady, setDevecoReady] = createSignal<boolean | null>(null)
  const [devecoInitialStep, setDevecoInitialStep] = createSignal<"entry" | "privacy">("entry")
  const [authCanEnter, setAuthCanEnter] = createSignal(false)
  const [authCheckDone, setAuthCheckDone] = createSignal(false)
  let devecoChecked = false

  const bodySlotHeight = createMemo(() => homeBodySlotRows(dimensions().height))

  const runDevecoCheck = async () => {
    if (devecoChecked) return
    devecoChecked = true

    if (!hasDevecoOAuthEntry()) {
      setDevecoInitialStep("entry")
      setDevecoReady(false)
      setAuthCheckDone(true)
      return
    }

    const session = await devecoAuth.getSession()

    if (!session) {
      setDevecoInitialStep("entry")
      setDevecoReady(false)
      setAuthCheckDone(true)
      return
    }

    let accessToken = session.accessToken
    if (!accessToken) {
      const newTokens = await devecoAuth.refreshToken()
      if (newTokens?.accessToken) {
        accessToken = newTokens.accessToken
      } else {
        setDevecoInitialStep("entry")
        setDevecoReady(false)
        setAuthCheckDone(true)
        return
      }
    }

    const userId = session.userId || (await devecoAuth.getUserId()) || ""

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

    if (!kv.ready) {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (kv.ready) {
            resolve()
            return
          }
          setTimeout(check, 50)
        }
        check()
        setTimeout(() => resolve(), 5000)
      })
    }

    agreementService.configure((sync.data.config as unknown as { agreement?: AgreementConfig }).agreement)
    const checkResult = await agreementService.checkAllAgreements(accessToken, userId, kv)

    if (checkResult.canEnter) {
      setAuthCanEnter(true)
      setAuthCheckDone(true)
      void agreementService.retryPendingSign(accessToken, userId, kv)
      if (sync.status === "complete") {
        setDevecoReady(true)
      }
    } else if (checkResult.overallStatus === AgreementStatus.SESSION_EXPIRED) {
      setDevecoInitialStep("entry")
      setDevecoReady(false)
      setAuthCheckDone(true)
    } else {
      setDevecoInitialStep("privacy")
      setDevecoReady(false)
      setAuthCheckDone(true)
    }
  }

  onMount(() => {
    void runDevecoCheck()
  })

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
              {connectedMcpCount() === 1 ? "1 mcp server" : `${connectedMcpCount()} mcp servers`}
            </Match>
          </Switch>
        </text>
      </box>
    </Show>
  )

  let prompt: PromptRef | undefined
  const args = useArgs()
  const local = useLocal()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const pluginRuntime = usePluginRuntime()

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
    <HomeSessionDestinationProvider>
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
              <pluginRuntime.Slot name="home_logo" mode="replace">
                <Banner contentInset={BANNER_HOME_CONTENT_INSET} />
              </pluginRuntime.Slot>
            </box>
            <box
              zIndex={1}
              position="relative"
              width="100%"
              height={bodySlotHeight()}
              maxHeight={HOME_BODY_MAX_ROWS}
              flexDirection="column"
              justifyContent={devecoReady() === true ? "center" : "flex-start"}
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
                    <pluginRuntime.Slot name="home_prompt" mode="replace">
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
                    </pluginRuntime.Slot>
                  </box>
                  <pluginRuntime.Slot name="home_bottom" />
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
        <pluginRuntime.Slot name="home_footer" mode="single_winner" />
      </box>
    </HomeSessionDestinationProvider>
  )
}
