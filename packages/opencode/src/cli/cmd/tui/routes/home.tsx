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
import { KV_DEVECO_CODE_PRIVACY_ACCEPTED } from "@/cli/deveco-legal"

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
  let devecoChecked = false

  const bodySlotHeight = createMemo(() => homeBodySlotRows(dimensions().height))

  // Check if DevEco onboarding should be shown - wait for sync blocking phase to complete
  createEffect(
    on(
      () => sync.status,
      (status) => {
        if (status === "loading") return
        // Only check once
        if (devecoChecked) return
        devecoChecked = true

        const privacyAccepted = kv.get(KV_DEVECO_CODE_PRIVACY_ACCEPTED, false)
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
      <box flexGrow={1} paddingLeft={2} paddingRight={2} flexDirection="column" minHeight={0}>
        <Show when={devecoReady() !== null}>
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
                  />
                </Show>
              </box>
            </box>
          </box>
        </Show>
        <Toast />
      </box>
      <box width="100%" flexShrink={0}>
        <TuiPluginRuntime.Slot name="home_footer" mode="single_winner" />
      </box>
    </>
  )
}
