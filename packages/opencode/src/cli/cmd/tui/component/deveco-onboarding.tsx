import { Show, createSignal, createMemo, For, createEffect } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { ScrollBoxRenderable, TextareaRenderable } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useExit } from "@tui/context/exit"
import { useDialog } from "@tui/ui/dialog"
import { useSDK } from "../context/sdk"
import { DialogSelect } from "@tui/ui/dialog-select"
import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { Link } from "../ui/link"
import { devecoAuth, ACCESS_TOKEN_EXPIRES_MS, saveAuthToDisk } from "@/plugin/deveco"
import { useKV } from "@tui/context/kv"
import { DEVECO_AI_PRIVACY_URL, KV_DEVECO_CODE_PRIVACY_ACCEPTED } from "@/cli/deveco-legal"
import { Banner } from "./banner"

type OnboardingStep = "privacy" | "entry" | "auth" | "providers" | "key"

const LIST_HELP = "Use Enter to Select"
const CONTENT_MAX_WIDTH = 110

function selectionLead(selected: boolean): string {
  return selected ? "● " : "  "
}

function providerLabel(id: string, name: string): string {
  if (id === "github-copilot") return "GitHub Copilot"
  if (id === "opencode") return "OpenCode Zen"
  return name
}

const PROVIDER_PRIORITY: Record<string, number> = {
  opencode: 0,
  "opencode-go": 1,
  openai: 2,
  "github-copilot": 3,
  anthropic: 4,
  google: 5,
  openrouter: 6,
}

export function DevEcoOnboarding(props: { onComplete: () => void }) {
  const { theme } = useTheme()
  const sync = useSync()
  const exit = useExit()
  const dialog = useDialog()
  const sdk = useSDK()
  const kv = useKV()

  const privacyOk = () => kv.get(KV_DEVECO_CODE_PRIVACY_ACCEPTED, false) === true
  const [step, setStep] = createSignal<OnboardingStep>(privacyOk() ? "entry" : "privacy")
  const [privacyIndex, setPrivacyIndex] = createSignal(0)
  const [entryIndex, setEntryIndex] = createSignal(0)
  const [authMessage, setAuthMessage] = createSignal<string | null>(null)
  const [authBusy, setAuthBusy] = createSignal(false)
  const [providerIndex, setProviderIndex] = createSignal(0)
  let authAborted = false
  const [providerQuery, setProviderQuery] = createSignal("")
  const [pid, setPid] = createSignal<string | null>(null)
  const [key, setKey] = createSignal("")
  let input: TextareaRenderable | undefined
  let providerScroll: ScrollBoxRenderable | undefined

  const providerList = createMemo(() => {
    return [...sync.data.provider_next.all]
      .filter((p) => p.id !== "deveco")
      .sort((a, b) => (PROVIDER_PRIORITY[a.id] ?? 99) - (PROVIDER_PRIORITY[b.id] ?? 99))
  })

  const filteredProviders = createMemo(() => {
    const q = providerQuery().toLowerCase().trim()
    const list = providerList()
    if (!q) return list
    return list.filter(
      (p) =>
        providerLabel(p.id, p.name).toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q),
    )
  })

  createEffect(() => {
    const list = filteredProviders()
    const idx = providerIndex()
    if (list.length === 0) {
      setProviderIndex(0)
      return
    }
    if (idx >= list.length) setProviderIndex(list.length - 1)
  })

  const dimensions = useTerminalDimensions()
  const providerScrollHeight = createMemo(() => {
    const maxHeight = Math.floor(dimensions().height / 2) - 12
    return Math.min(filteredProviders().length, Math.max(maxHeight, 5))
  })

  const providerSearchBoxWidth = createMemo(() => {
    // 75 matches the surrounding maxWidth; clamp to terminal width (minus Home padding).
    const w = Math.floor(dimensions().width) - 4
    return Math.max(16, Math.min(75, w))
  })

  const fitText = (s: string, w: number) => {
    if (w <= 0) return ""
    if (s.length === w) return s
    if (s.length < w) return s + " ".repeat(w - s.length)
    return s.slice(0, w)
  }

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
    authAborted = false
    try {
      const result = await devecoAuth.login()
      if (authAborted) return
      if (!result.success) {
        if (result.cancelled) {
          setStep("entry")
          setAuthBusy(false)
          return
        }
        setAuthMessage(result.error ?? "Login failed")
        setAuthBusy(false)
        return
      }
      const access = result.userInfo?.accessToken || ""
      const refresh = result.userInfo?.refreshToken || ""
      await saveAuthToDisk("deveco", {
        type: "oauth",
        access,
        refresh,
        expires: Date.now() + ACCESS_TOKEN_EXPIRES_MS,
      })
      await sdk.client.instance.dispose()
      await sync.bootstrap()
      setAuthBusy(false)
      props.onComplete()
    } catch (error) {
      if (authAborted) return
      const errorMessage = error instanceof Error ? error.message : "Login failed"
      setAuthMessage(errorMessage)
      setAuthBusy(false)
    }
  }

  const apiKeyTitle = (providerId: string) => {
    const row = sync.data.provider_next.all.find((p) => p.id === providerId)
    const name = row ? providerLabel(row.id, row.name) : providerId
    return `Enter ${name} API Key`
  }

  const submitKey = async (providerId: string, value: string) => {
    await sdk.client.auth.set({
      providerID: providerId,
      auth: { type: "api", key: value },
    })
    await sdk.client.instance.dispose()
    await sync.bootstrap()
    props.onComplete()
  }

  const [keySubmitBusy, setKeySubmitBusy] = createSignal(false)
  const trySubmitApiKey = () => {
    if (keySubmitBusy()) return
    const id = pid()
    if (!id) return
    const value = (input?.plainText ?? key()).trim()
    if (!value) return
    setKeySubmitBusy(true)
    void submitKey(id, value).finally(() => setKeySubmitBusy(false))
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
      dialog.clear()
    }

    const method = methods[methodIndex]

    if (method.type === "api") {
      setPid(providerId)
      setKey("")
      setStep("key")
      return
    }

    if (method.type === "oauth") {
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

  const appendFilterKey = (name: string): boolean => {
    if (name === "space") {
      setProviderQuery((q) => `${q} `)
      return true
    }
    if (name.length === 1 && /[a-z0-9._-]/i.test(name)) {
      setProviderQuery((q) => q + name)
      return true
    }
    return false
  }

  useKeyboard((evt) => {
    if (dialog.stack.length > 0) return

    const st = step()

    if (st === "privacy") {
      if (evt.ctrl && evt.name === "c") {
        evt.preventDefault()
        void exit()
        return
      }
      if (evt.name === "up") {
        evt.preventDefault()
        setPrivacyIndex(0)
        return
      }
      if (evt.name === "down") {
        evt.preventDefault()
        setPrivacyIndex(1)
        return
      }
      if (evt.name === "return") {
        evt.preventDefault()
        if (privacyIndex() === 0) {
          kv.set(KV_DEVECO_CODE_PRIVACY_ACCEPTED, true)
          setStep("entry")
        } else {
          void exit()
        }
      }
      return
    }

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
          return
        }
        setProviderQuery("")
        setProviderIndex(0)
        setStep("providers")
      }
      return
    }

    if (st === "auth") {
      if (evt.ctrl && evt.name === "c") {
        evt.preventDefault()
        void exit()
        return
      }
      if (evt.name === "escape") {
        evt.preventDefault()
        if (authBusy()) {
          authAborted = true
          devecoAuth.cancel()
          setAuthBusy(false)
        }
        setStep("entry")
        return
      }
      if (authBusy()) return
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
        if (providerQuery().length > 0) {
          setProviderQuery("")
          setProviderIndex(0)
          return
        }
        setStep("entry")
        return
      }
      if (evt.name === "backspace") {
        evt.preventDefault()
        if (providerQuery().length > 0) {
          setProviderQuery((q) => q.slice(0, -1))
          setProviderIndex(0)
        }
        return
      }
      const list = filteredProviders()
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
        return
      }
      if (!evt.ctrl && !evt.meta && appendFilterKey(evt.name)) {
        evt.preventDefault()
        setProviderIndex(0)
        scrollToProvider(0)
      }
    }

    if (st === "key") {
      if (evt.ctrl && evt.name === "c") {
        if (key().length > 0) {
          evt.preventDefault()
          setKey("")
          input?.clear()
          return
        }
        evt.preventDefault()
        void exit()
        return
      }
      if (evt.name === "escape") {
        evt.preventDefault()
        setStep("providers")
        return
      }
      if (evt.name === "return") {
        evt.preventDefault()
        trySubmitApiKey()
      }
    }
  })

  return (
    <box flexDirection="column" gap={1} paddingTop={1} flexShrink={0} flexGrow={1} minHeight={0}>
      <Show when={step() === "privacy"}>
        <box flexDirection="column" gap={2} alignItems="center" flexShrink={0}>
          <Banner />
          <box flexDirection="column" width="100%" maxWidth={CONTENT_MAX_WIDTH}>
            <text fg={theme.text} selectable={false}>
              Please read and agree to the privacy statement to start the HarmonyOS development journey.
            </text>
            <Link href={DEVECO_AI_PRIVACY_URL} fg={theme.primary} />
            
            <text fg={privacyIndex() === 0 ? theme.success : theme.text} selectable={false} marginTop={1}>
              {selectionLead(privacyIndex() === 0)}
              1. I agree
            </text>
            <text fg={privacyIndex() === 1 ? theme.success : theme.text} selectable={false}>
              {selectionLead(privacyIndex() === 1)}
              2. No, exit
            </text>
          </box>
        </box>
      </Show>
      <Show when={step() === "entry"}>
        <box flexDirection="column" gap={2} alignItems="center" flexShrink={0}>
          <Banner />
          <box flexDirection="column" width="100%" maxWidth={CONTENT_MAX_WIDTH}>
            <text fg={theme.text} attributes={1} selectable={false} marginBottom={1}>
              Get started
            </text>
            <text fg={entryIndex() === 0 ? theme.success : theme.text} selectable={false}>
              {selectionLead(entryIndex() === 0)}
              1. Login through a browser
            </text>
            <text fg={entryIndex() === 1 ? theme.success : theme.text} selectable={false}>
              {selectionLead(entryIndex() === 1)}
              2. Other providers
            </text>
            <text fg={theme.textMuted} selectable={false} marginTop={1}>{LIST_HELP}</text>
          </box>
        </box>
      </Show>
      <Show when={step() === "auth"}>
        <box flexDirection="column" gap={2} alignItems="center" flexShrink={0}>
          <Banner />
          <box flexDirection="column" width="100%" maxWidth={CONTENT_MAX_WIDTH}>
            <text fg={theme.text} selectable={false}>
              Login through a browser
            </text>
            <text fg={theme.textMuted} selectable={false}>
              {authBusy() ? "Waiting for browser…" : "Press Enter to open the login page"}
            </text>
            <Show when={authMessage() !== null}>
              <text fg={theme.error} selectable={false}>
                {authMessage()}
              </text>
            </Show>
            <Show when={authBusy()}>
              <text fg={theme.textMuted} selectable={false}>
                Press Esc to go back
              </text>
            </Show>
          </box>
        </box>
      </Show>
      <Show when={step() === "providers"}>
        <box flexDirection="column" gap={2} alignItems="center" flexShrink={0}>
          <Banner />
          <box flexDirection="column" width="100%" maxWidth={CONTENT_MAX_WIDTH}>
            <text fg={theme.text} attributes={1} selectable={false}>
              Please select provider
            </text>
            <box flexDirection="column" width={providerSearchBoxWidth()}>
              <text fg={theme.textMuted} selectable={false} wrapMode="none">
                {`╭${"─".repeat(Math.max(0, providerSearchBoxWidth() - 2))}╮`}
              </text>
              <text selectable={false} wrapMode="none">
                <span style={{ fg: theme.textMuted }}>│</span>
                <span style={{ fg: providerQuery() ? theme.text : theme.textMuted }}>
                  {fitText(` ${providerQuery() || "Search"}`, Math.max(0, providerSearchBoxWidth() - 2))}
                </span>
                <span style={{ fg: theme.textMuted }}>│</span>
              </text>
              <text fg={theme.textMuted} selectable={false} wrapMode="none">
                {`╰${"─".repeat(Math.max(0, providerSearchBoxWidth() - 2))}╯`}
              </text>
            </box>
            <scrollbox
              ref={(r: ScrollBoxRenderable) => (providerScroll = r)}
              maxHeight={providerScrollHeight()}
              scrollbarOptions={{ visible: false }}
            >
              <For each={filteredProviders()}>
                {(provider, idx) => (
                  <text fg={providerIndex() === idx() ? theme.success : theme.text} selectable={false}>
                    {selectionLead(providerIndex() === idx())}
                    {idx() + 1}. {providerLabel(provider.id, provider.name)}
                  </text>
                )}
              </For>
            </scrollbox>
            <text fg={theme.textMuted} selectable={false} marginTop={1}>
              Use Enter to Select, Esc to Cancel, Type : to search
            </text>
          </box>
        </box>
      </Show>
      <Show when={step() === "key"}>
        <box flexDirection="column" gap={2} alignItems="center" flexShrink={0}>
          <Banner />
          <box flexDirection="column" width="100%" maxWidth={CONTENT_MAX_WIDTH}>
            <text fg={theme.text} attributes={1} selectable={false}>
              {pid() ? apiKeyTitle(pid()!) : "Enter API Key"}
            </text>
            <box flexDirection="column" width={providerSearchBoxWidth()}>
              <text fg={theme.textMuted} selectable={false} wrapMode="none">
                {`╭${"─".repeat(Math.max(0, providerSearchBoxWidth() - 2))}╮`}
              </text>
              <box flexDirection="row" width={providerSearchBoxWidth()}>
                <text fg={theme.textMuted} selectable={false} wrapMode="none">
                  │
                </text>
                <textarea
                  focused={true}
                  ref={(r: TextareaRenderable) => (input = r)}
                  height={1}
                  width={Math.max(0, providerSearchBoxWidth() - 2)}
                  placeholder=" Paste API Key here"
                  textColor={theme.text}
                  focusedTextColor={theme.text}
                  cursorColor={theme.text}
                  onContentChange={() => setKey(input?.plainText ?? "")}
                  onSubmit={() => trySubmitApiKey()}
                />
                <text fg={theme.textMuted} selectable={false} wrapMode="none">
                  │
                </text>
              </box>
              <text fg={theme.textMuted} selectable={false} wrapMode="none">
                {`╰${"─".repeat(Math.max(0, providerSearchBoxWidth() - 2))}╯`}
              </text>
            </box>
            <text fg={theme.textMuted} selectable={false} marginTop={1}>
              Use Enter to submit, Esc to Cancel, Ctrl+C to Clear
            </text>
          </box>
        </box>
      </Show>
    </box>
  )
}
