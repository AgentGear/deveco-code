import { Prompt, type PromptRef } from "../component/prompt"
import { createEffect, createMemo, on, onMount, Show, Switch, Match } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "../context/theme"
import {
  Banner,
  BANNER_HOME_CONTENT_INSET,
  HOME_BODY_GAP_ROWS,
  HOME_BODY_MAX_ROWS,
  HOME_CONTENT_MAX_WIDTH,
  homeBodySlotRows,
} from "../component/banner"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useRouteData } from "../context/route"
import { usePromptRef } from "../context/prompt"
import { useLocal } from "../context/local"
import { usePluginRuntime } from "../plugin/runtime"
import { HomeSessionDestinationProvider } from "./home/session-destination"
import { getDevEcoExtensions } from "../deveco-extensions"

// TODO: what is the best way to do this?
let once = false

const placeholder = {
  normal: ["Fix a TODO in the codebase", "What is the tech stack of this project?", "Fix broken tests"],
  shell: ["ls -la", "git status", "pwd"],
}

export function Home() {
  const pluginRuntime = usePluginRuntime()
  const sync = useSync()
  const { theme } = useTheme()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const dimensions = useTerminalDimensions()
  const args = useArgs()
  const local = useLocal()

  const bodySlotHeight = createMemo(() => homeBodySlotRows(dimensions().height))

  // If DevEco has registered its home body extension, delegate the entire center
  // slot to it. DevEco handles auth + agreement + onboarding + prompt rendering
  // internally, keeping the TUI package generic.
  const DevEcoBody = getDevEcoExtensions().homeBody
  if (DevEcoBody) {
    return <DevEcoBody sync={sync} bodySlotHeight={bodySlotHeight()} />
  }

  // Generic fallback — upstream OpenCode layout (no DevEco onboarding).
  let prompt: PromptRef | undefined

  const mcpError = createMemo(() => Object.values(sync.data.mcp).some((x) => x.status === "failed"))
  const connectedMcpCount = createMemo(() =>
    Object.values(sync.data.mcp).filter((x) => x.status === "connected").length,
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
              {connectedMcpCount() === 1 ? "1 mcp server" : `${connectedMcpCount()} mcp servers`}
            </Match>
          </Switch>
        </text>
      </box>
    </Show>
  )

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
              justifyContent="center"
              alignItems="center"
              paddingTop={HOME_BODY_GAP_ROWS}
              flexShrink={0}
            >
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
