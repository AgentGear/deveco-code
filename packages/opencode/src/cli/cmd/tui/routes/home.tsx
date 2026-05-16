import { Prompt, type PromptRef } from "@tui/component/prompt"
import { createEffect, createMemo, createSignal, Match, on, onMount, Show, Switch } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { Banner } from "../component/banner"
import { pluralize } from "@/util/locale"
import { useSync } from "../context/sync"
import { useKV } from "../context/kv"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useDirectory } from "../context/directory"
import { useRouteData } from "@tui/context/route"
import { usePromptRef } from "../context/prompt"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { useLocal } from "../context/local"
import { DevEcoOnboarding } from "../component/deveco-onboarding"
import { TuiPluginRuntime } from "@/cli/cmd/tui/plugin/runtime"
import { Tips } from "../feature-plugins/home/tips-view"
import { KV_CODEGENIE_DEVECO_PRIVACY_ACCEPTED } from "@/cli/codegenie-legal"

// TODO: what is the best way to do this?
let once = false

export function Home() {
  const sync = useSync()
  const kv = useKV()
  const { theme } = useTheme()
  const route = useRouteData("home")
  const promptRef = usePromptRef()

  // DevEco onboarding state - null = checking, false = show onboarding, true = ready
  const [devecoReady, setDevecoReady] = createSignal<boolean | null>(null)
  let devecoChecked = false

  // Check if DevEco onboarding should be shown - wait for sync to complete
  createEffect(
    on(
      () => sync.status,
      (status) => {
        if (status !== "complete") return
        // Only check once
        if (devecoChecked) return
        devecoChecked = true

        const privacyAccepted = kv.get(KV_CODEGENIE_DEVECO_PRIVACY_ACCEPTED, false)
        const hasCredentials = sync.data.provider.some(
          (x) => x.id !== "opencode" || Object.values(x.models).some((y) => y.cost?.input !== 0),
        )
        if (!privacyAccepted || !hasCredentials) {
          setDevecoReady(false)
        } else {
          setDevecoReady(true)
        }
      },
    ),
  )

  const mcpError = createMemo(() => {
    return Object.values(sync.data.mcp).some((x) => x.status === "failed")
  })

  const connectedMcpCount = createMemo(() => {
    return Object.values(sync.data.mcp).filter((x) => x.status === "connected").length
  })

  const providerConnected = createMemo(() =>
    sync.data.provider.some(
      (x) => x.id !== "opencode" || Object.values(x.models).some((y) => y.cost?.input !== 0),
    ),
  )

  const tipsHidden = createMemo(() => kv.get("tips_hidden", false))
  const tipsFirstSession = createMemo(() => sync.data.session.length === 0)
  const showTips = createMemo(
    () => (!tipsFirstSession() || !providerConnected()) && !tipsHidden(),
  )

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
  const directory = useDirectory()

  return (
    <>
      <box
        flexGrow={1}
        paddingLeft={2}
        paddingRight={2}
        flexDirection="column"
        alignItems="flex-start"
        justifyContent="flex-start"
      >
        <Show when={devecoReady()}>
          <box
            paddingLeft={2}
            paddingRight={2}
            width="100%"
            flexDirection="column"
            alignItems="center"
            flexShrink={0}
            paddingTop={1}
          >
            <box width="100%" flexDirection="column" alignItems="center" flexShrink={0}>
              <TuiPluginRuntime.Slot name="home_logo" mode="replace">
                <Banner />
              </TuiPluginRuntime.Slot>
              <box width="100%" maxWidth={110} zIndex={1000} paddingTop={2} flexShrink={0}>
                <TuiPluginRuntime.Slot name="home_prompt" mode="replace">
                  <Prompt
                    ref={(r) => {
                      if (r) {
                        prompt = r
                        promptRef.set(r)
                      }
                    }}
                    hint={Hint}
                    footerRight={
                      <Show when={showTips()}>
                        <Tips connected={providerConnected()} />
                      </Show>
                    }
                  />
                </TuiPluginRuntime.Slot>
              </box>
              <TuiPluginRuntime.Slot name="home_bottom" />
            </box>
          </box>
        </Show>
        <Show when={devecoReady() === false}>
          <DevEcoOnboarding onComplete={() => setDevecoReady(true)} />
        </Show>
        <box flexGrow={1} minHeight={0} flexShrink={1} />
        <Toast />
      </box>
      <box paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} flexDirection="row" flexShrink={0} gap={2}>
        <text fg={theme.textMuted}>{directory()}</text>
        <box gap={1} flexDirection="row" flexShrink={0}>
          {/* <Show when={mcp()}> */}
          <text fg={theme.text}>
            <Switch>
              <Match when={mcpError()}>
                <span style={{ fg: theme.error }}>⊙ </span>
              </Match>
              <Match when={true}>
                <span style={{ fg: connectedMcpCount() > 0 ? theme.success : theme.textMuted }}>⊙ </span>
              </Match>
            </Switch>
            {connectedMcpCount()} MCP
          </text>
          <text fg={theme.textMuted}>/status</text>
          {/* </Show> */}
        </box>
        <box flexGrow={1} />
        <box flexShrink={0}>
          <text fg={theme.textMuted}>Version: {InstallationVersion}</text>
        </box>
      </box>
    </>
  )
}
