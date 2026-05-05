import { Prompt, type PromptRef } from "@tui/component/prompt"
import { createEffect, createMemo, createSignal, Match, on, onMount, Show, Switch } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { Logo } from "../component/logo"
import { pluralize } from "@/util/locale"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useDirectory } from "../context/directory"
import { useRouteData } from "@tui/context/route"
import { usePromptRef } from "../context/prompt"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { useCommandDialog } from "../component/dialog-command"
import { useLocal } from "../context/local"
import { CodeGenieOnboarding } from "../component/codegenie-onboarding"
import { TuiPluginRuntime } from "@/cli/cmd/tui/plugin/runtime"

// TODO: what is the best way to do this?
let once = false

export function Home() {
  const sync = useSync()
  const { theme } = useTheme()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const command = useCommandDialog()

  // CodeGenie onboarding state - null = checking, false = show onboarding, true = ready
  const [codegenieReady, setCodegenieReady] = createSignal<boolean | null>(null)
  let codegenieChecked = false

  // Check if CodeGenie onboarding should be shown - wait for sync to complete
  createEffect(
    on(
      () => sync.status,
      (status) => {
        if (status !== "complete") return
        // Only check once
        if (codegenieChecked) return
        codegenieChecked = true

        // Check if user has any credentials via sync provider data
        const hasCredentials = sync.data.provider.some(
          (x) => x.id !== "opencode" || Object.values(x.models).some((y) => y.cost?.input !== 0),
        )
        if (!hasCredentials) {
          setCodegenieReady(false)
        } else {
          setCodegenieReady(true)
        }
      },
    ),
  )

  const mcp = createMemo(() => Object.keys(sync.data.mcp).length > 0)
  const mcpError = createMemo(() => {
    return Object.values(sync.data.mcp).some((x) => x.status === "failed")
  })

  const connectedMcpCount = createMemo(() => {
    return Object.values(sync.data.mcp).filter((x) => x.status === "connected").length
  })

  command.register(() => [])

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
      <box flexGrow={1} paddingLeft={2} paddingRight={2} flexDirection="column" alignItems="center">
        <box flexGrow={1} minHeight={0} flexShrink={1} />
        <Show when={codegenieReady()}>
          <box flexDirection="row" gap={4} alignItems="flex-start" flexShrink={0}>
            <box flexShrink={0}>
              <TuiPluginRuntime.Slot name="home_logo" mode="replace">
                <Logo column="left" />
              </TuiPluginRuntime.Slot>
            </box>
            <box flexDirection="column" flexGrow={1} minWidth={0}>
              <box flexShrink={0}>
                <TuiPluginRuntime.Slot name="home_logo_right" mode="replace">
                  <Logo column="right" />
                </TuiPluginRuntime.Slot>
              </box>
              <box width="100%" maxWidth={75} zIndex={1000} paddingTop={1} flexShrink={0}>
                <TuiPluginRuntime.Slot name="home_prompt" mode="replace">
                  <Prompt
                    ref={(r) => {
                      if (r) {
                        prompt = r
                        promptRef.set(r)
                      }
                    }}
                    hint={Hint}
                  />
                </TuiPluginRuntime.Slot>
              </box>
              <TuiPluginRuntime.Slot name="home_bottom" />
            </box>
          </box>
        </Show>
        <Show when={codegenieReady() === false}>
          <CodeGenieOnboarding onComplete={() => setCodegenieReady(true)} />
        </Show>
        <box flexGrow={1} minHeight={0} flexShrink={1} />
        <Toast />
      </box>
      <box paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} flexDirection="row" flexShrink={0} gap={2}>
        <text fg={theme.textMuted}>{directory()}</text>
        <box gap={1} flexDirection="row" flexShrink={0}>
          <Show when={mcp()}>
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
          </Show>
        </box>
        <box flexGrow={1} />
        <box flexShrink={0}>
          <text fg={theme.textMuted}>{InstallationVersion}</text>
        </box>
      </box>
    </>
  )
}