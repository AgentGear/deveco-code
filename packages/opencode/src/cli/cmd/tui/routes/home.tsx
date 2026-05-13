import { Prompt, type PromptRef } from "@tui/component/prompt"
import { createEffect, createSignal, on, onMount, Show } from "solid-js"
import { Logo } from "../component/logo"
import { useProject } from "../context/project"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useRouteData } from "@tui/context/route"
import { usePromptRef } from "../context/prompt"
import { useLocal } from "../context/local"
import { CodeGenieOnboarding } from "../component/codegenie-onboarding"
import { TuiPluginRuntime } from "@/cli/cmd/tui/plugin/runtime"
import { useEditorContext } from "@tui/context/editor"

let once = false
const placeholder = {
  normal: ["Fix a TODO in the codebase", "What is the tech stack of this project?", "Fix broken tests"],
  shell: ["ls -la", "git status", "pwd"],
}

export function Home() {
  const sync = useSync()
  const project = useProject()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const [ref, setRef] = createSignal<PromptRef | undefined>()
  const args = useArgs()
  const local = useLocal()
  const editor = useEditorContext()
  let sent = false

  // CodeGenie onboarding state - null = checking, false = show onboarding, true = ready
  const [codegenieReady, setCodegenieReady] = createSignal<boolean | null>(null)
  let codegenieChecked = false

  // Check if CodeGenie onboarding should be shown - wait for sync to complete
  createEffect(
    on(
      () => sync.status,
      (status) => {
        if (status !== "complete") return
        if (codegenieChecked) return
        codegenieChecked = true

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

  onMount(() => {
    editor.clearSelection()
  })

  const bind = (r: PromptRef | undefined) => {
    setRef(r)
    promptRef.set(r)
    if (once || !r) return
    if (route.prompt) {
      r.set(route.prompt)
      once = true
      return
    }
    if (!args.prompt) return
    r.set({ input: args.prompt, parts: [] })
    once = true
  }

  // Wait for sync and model store to be ready before auto-submitting --prompt
  createEffect(() => {
    const r = ref()
    if (sent) return
    if (!r) return
    if (!sync.ready || !local.model.ready) return
    if (!args.prompt) return
    if (r.current.input !== args.prompt) return
    sent = true
    r.submit()
  })

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
                <TuiPluginRuntime.Slot
                  name="home_prompt"
                  mode="replace"
                  workspace_id={project.workspace.current()}
                  ref={bind}
                >
                  <Prompt
                    ref={bind}
                    workspaceID={project.workspace.current()}
                    right={<TuiPluginRuntime.Slot name="home_prompt_right" workspace_id={project.workspace.current()} />}
                    placeholders={placeholder}
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
      <box width="100%" flexShrink={0}>
        <TuiPluginRuntime.Slot name="home_footer" mode="single_winner" />
      </box>
    </>
  )
}
