import { Show, createSignal, createMemo, For } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { ScrollBoxRenderable } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useExit } from "@tui/context/exit"
import { useDialog } from "@tui/ui/dialog"
import { useSDK } from "../context/sdk"
import { DialogSelect } from "@tui/ui/dialog-select"
import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { Link } from "../ui/link"
import { codegenieAuth, ACCESS_TOKEN_EXPIRES_MS, saveAuthToDisk } from "@/plugin/codegenie"
import { Logo } from "./logo"

type OnboardingStep = "entry" | "auth" | "providers"

const LIST_HELP = "Use ↑/↓ and Enter · Ctrl+C to exit"

function selectionLead(selected: boolean): string {
  return selected ? "● " : "  "
}

const PROVIDER_PRIORITY: Record<string, number> = {
  opencode: 0,
  "opencode-go": 1,
  openai: 2,
  "github-copilot": 3,
  anthropic: 4,
  google: 5,
}

export function CodeGenieOnboarding(props: { onComplete: () => void }) {
  const { theme } = useTheme()
  const sync = useSync()
  const exit = useExit()
  const dialog = useDialog()
  const sdk = useSDK()

  const [step, setStep] = createSignal<OnboardingStep>("entry")
  const [entryIndex, setEntryIndex] = createSignal(0)
  const [authMessage, setAuthMessage] = createSignal<string | null>(null)
  const [authBusy, setAuthBusy] = createSignal(false)
  const [providerIndex, setProviderIndex] = createSignal(0)
  let providerScroll: ScrollBoxRenderable | undefined

  const providerList = createMemo(() => {
    return [...sync.data.provider_next.all]
      .filter((p) => p.id !== "codegenie")
      .sort((a, b) => (PROVIDER_PRIORITY[a.id] ?? 99) - (PROVIDER_PRIORITY[b.id] ?? 99))
  })

  const dimensions = useTerminalDimensions()
  const providerScrollHeight = createMemo(() => {
    const maxHeight = Math.floor(dimensions().height / 2) - 6
    return Math.min(providerList().length, Math.max(maxHeight, 5))
  })

  const scrollToProvider = (index: number) => {
    if (!providerScroll) return
    const children = providerScroll.getChildren()
    const target = children[index]
    if (!target) return
    const y = target.y - providerScroll.y
    if (y >= providerScroll.height) {
      providerScroll.scrollBy(y - providerScroll.height + 1)
    }
    if (y < 0) {
      providerScroll.scrollBy(y)
      if (index === 0) {
        providerScroll.scrollTo(0)
      }
    }
  }

  const runBrowserLogin = async () => {
    setAuthBusy(true)
    setAuthMessage(null)
    try {
      const result = await codegenieAuth.login()
      if (!result.success) {
        setAuthMessage(result.error ?? "Login failed")
        setAuthBusy(false)
        return
      }
      const access = result.userInfo?.accessToken || ""
      const refresh = result.userInfo?.refreshToken || ""
      await saveAuthToDisk("codegenie", {
        type: "oauth",
        access,
        refresh,
        expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
      })
      await sdk.client.instance.dispose()
      await sync.bootstrap()
      props.onComplete()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Login failed"
      setAuthMessage(errorMessage)
      setAuthBusy(false)
    }
  }

  const handleProviderSelect = async (providerId: string) => {
    const methods = sync.data.provider_auth[providerId] ?? [
      { type: "api" as const, label: "API key" },
    ]

    let methodIndex = 0
    if (methods.length > 1) {
      const idx = await new Promise<number | null>((resolve) => {
        dialog.replace(
          () => (
            <DialogSelect
              title="Select auth method"
              options={methods.map((m, i) => ({
                title: m.label,
                value: i,
              }))}
              onSelect={(opt) => resolve(opt.value)}
            />
          ),
          () => resolve(null),
        )
      })
      if (idx === null) return
      methodIndex = idx
    }

    const method = methods[methodIndex]

    if (method.type === "api") {
      const value = await DialogPrompt.show(dialog, method.label, {
        placeholder: "API key",
      })
      if (!value) return
      await sdk.client.auth.set({
        providerID: providerId,
        auth: { type: "api", key: value },
      })
      await sdk.client.instance.dispose()
      await sync.bootstrap()
      dialog.clear()
      props.onComplete()
      return
    }

    if (method.type === "oauth") {
      // Handle prompts if any
      let inputs: Record<string, string> | undefined
      if (method.prompts?.length) {
        inputs = {}
        for (const p of method.prompts) {
          if (p.when) {
            const prev = inputs[p.when.key]
            if (prev === undefined) continue
            const matches = p.when.op === "eq" ? prev === p.when.value : prev !== p.when.value
            if (!matches) continue
          }

          if (p.type === "select") {
            const value = await new Promise<string | null>((resolve) => {
              dialog.replace(
                () => (
                  <DialogSelect
                    title={p.message}
                    options={p.options.map((opt) => ({
                      title: opt.label,
                      value: opt.value,
                      description: opt.hint,
                    }))}
                    onSelect={(opt) => resolve(opt.value)}
                  />
                ),
                () => resolve(null),
              )
            })
            if (value === null) return
            inputs[p.key] = value
          } else {
            const value = await DialogPrompt.show(dialog, p.message, {
              placeholder: p.placeholder,
            })
            if (!value) return
            inputs[p.key] = value
          }
        }
      }

      const result = await sdk.client.provider.oauth.authorize({
        providerID: providerId,
        method: methodIndex,
        inputs,
      })
      if (result.error) {
        dialog.clear()
        return
      }

      if (result.data?.method === "code") {
        const code = await DialogPrompt.show(dialog, method.label, {
          placeholder: "Authorization code",
          description: () => (
            <box gap={1}>
              <text fg={theme.textMuted}>{result.data!.instructions}</text>
              <Link href={result.data!.url} fg={theme.primary} />
            </box>
          ),
        })
        if (!code) return
        const cbResult = await sdk.client.provider.oauth.callback({
          providerID: providerId,
          method: methodIndex,
          code,
        })
        if (cbResult.error) return
        await sdk.client.instance.dispose()
        await sync.bootstrap()
        props.onComplete()
        return
      }

      if (result.data?.method === "auto") {
        dialog.replace(
          () => (
            <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
              <text fg={theme.text}>{method.label}</text>
              <box gap={1}>
                <Link href={result.data!.url} fg={theme.primary} />
                <text fg={theme.textMuted}>{result.data!.instructions}</text>
              </box>
              <text fg={theme.textMuted}>Waiting for authorization...</text>
            </box>
          ),
        )
        const cbResult = await sdk.client.provider.oauth.callback({
          providerID: providerId,
          method: methodIndex,
        })
        dialog.clear()
        if (cbResult.error) return
        await sdk.client.instance.dispose()
        await sync.bootstrap()
        props.onComplete()
      }
    }
  }

  useKeyboard((evt) => {
    // Don't handle keyboard when dialog is open
    if (dialog.stack.length > 0) return

    const st = step()

    if (st === "entry") {
      if (evt.ctrl && evt.name === "c") {
        evt.preventDefault()
        void exit()
        return
      }
      if (evt.name === "up") {
        evt.preventDefault()
        setEntryIndex(0)
        return
      }
      if (evt.name === "down") {
        evt.preventDefault()
        setEntryIndex(1)
        return
      }
      if (evt.name === "return") {
        evt.preventDefault()
        const idx = entryIndex()
        if (idx === 0) {
          setStep("auth")
          void runBrowserLogin()
        } else {
          setStep("providers")
          setProviderIndex(0)
        }
      }
      return
    }

    if (st === "auth") {
      if (authBusy()) return
      if (evt.ctrl && evt.name === "c") {
        evt.preventDefault()
        void exit()
        return
      }
      if (evt.name === "escape") {
        evt.preventDefault()
        setStep("entry")
        return
      }
      if (evt.name === "return") {
        evt.preventDefault()
        void runBrowserLogin()
      }
      return
    }

    if (st === "providers") {
      if (evt.ctrl && evt.name === "c") {
        evt.preventDefault()
        void exit()
        return
      }
      if (evt.name === "escape") {
        evt.preventDefault()
        setStep("entry")
        return
      }
      const list = providerList()
      if (evt.name === "up") {
        evt.preventDefault()
        const newIndex = Math.max(0, providerIndex() - 1)
        setProviderIndex(newIndex)
        scrollToProvider(newIndex)
        return
      }
      if (evt.name === "down") {
        evt.preventDefault()
        const newIndex = Math.min(Math.max(list.length - 1, 0), providerIndex() + 1)
        setProviderIndex(newIndex)
        scrollToProvider(newIndex)
        return
      }
      if (evt.name === "return") {
        evt.preventDefault()
        const idx = providerIndex()
        const provider = list[idx]
        if (provider) {
          void handleProviderSelect(provider.id)
        }
      }
    }
  })

  return (
    <box flexDirection="column" width="100%" maxWidth={75} gap={1} paddingTop={1} flexShrink={0} flexGrow={1} minHeight={0}>
      <Show when={step() === "entry"}>
        <box flexDirection="row" gap={2} alignItems="flex-start" flexShrink={0}>
          <Logo column="left" />
          <box flexDirection="column" flexGrow={1} minWidth={0}>
            <Logo column="right" />
            <text fg={theme.text} attributes={1} selectable={false}>
              Get started with CodeGenie
            </text>
            <text fg={theme.textMuted} selectable={false}>
              {LIST_HELP}
            </text>
            <text fg={entryIndex() === 0 ? theme.success : theme.text} selectable={false}>
              {selectionLead(entryIndex() === 0)}
              CodeGenie OAuth
            </text>
            <text fg={entryIndex() === 1 ? theme.success : theme.text} selectable={false}>
              {selectionLead(entryIndex() === 1)}
              Other providers
            </text>
          </box>
        </box>
      </Show>
      <Show when={step() === "auth"}>
        <box flexDirection="row" gap={2} alignItems="flex-start" flexShrink={0}>
          <Logo column="left" />
          <box flexDirection="column" flexGrow={1} minWidth={0}>
            <Logo column="right" />
            <text fg={theme.text} selectable={false}>
              Sign in with your browser
            </text>
            <text fg={theme.textMuted} selectable={false}>
              {authBusy() ? "Waiting for browser…" : "Press Enter to open the login page"}
            </text>
            <Show when={authMessage() !== null}>
              <text fg={theme.error} selectable={false}>
                {authMessage()}
              </text>
            </Show>
            <Show when={!authBusy()}>
              <text fg={theme.textMuted} selectable={false}>
                Press Esc to go back
              </text>
            </Show>
          </box>
        </box>
      </Show>
      <Show when={step() === "providers"}>
        <box flexDirection="row" gap={2} alignItems="flex-start" flexShrink={0}>
          <Logo column="left" />
          <box flexDirection="column" flexGrow={1} minWidth={0}>
            <Logo column="right" />
            <text fg={theme.text} attributes={1} selectable={false}>
              Select a provider
            </text>
            <text fg={theme.textMuted} selectable={false}>
              Use ↑/↓ and Enter · Esc to go back
            </text>
            <scrollbox
              ref={(r: ScrollBoxRenderable) => (providerScroll = r)}
              maxHeight={providerScrollHeight()}
              scrollbarOptions={{ visible: false }}
            >
              <For each={providerList()}>
                {(provider, idx) => (
                  <text fg={providerIndex() === idx() ? theme.success : theme.text} selectable={false}>
                    {selectionLead(providerIndex() === idx())}
                    {provider.name}
                  </text>
                )}
              </For>
            </scrollbox>
          </box>
        </box>
      </Show>
    </box>
  )
}
