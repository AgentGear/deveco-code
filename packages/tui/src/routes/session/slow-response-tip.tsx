import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import { RGBA } from "@opentui/core"
import { useSync } from "../../context/sync"
import { useEvent } from "../../context/event"
import { useLocal } from "../../context/local"
import { useTheme } from "../../context/theme"
import { useI18n } from "../../i18n"
import { useKV } from "../../context/kv"
import { createFadeIn } from "../../util/signal"
import { isDevecoProvider } from "../../util/model"
import type { UserMessage } from "@opencode-ai/sdk/v2"

function fadeColor(color: RGBA, alpha: number) {
  return RGBA.fromValues(color.r, color.g, color.b, color.a * alpha)
}

export function SlowResponseTip(props: { sessionID: string }) {
  const { t } = useI18n()
  const { theme } = useTheme()
  const sync = useSync()
  const event = useEvent()
  const local = useLocal()
  const kv = useKV()
  const animationsEnabled = createMemo(() => kv.get("animations_enabled", true))

  const statusType = createMemo(() => sync.data.session_status?.[props.sessionID ?? ""]?.type ?? "idle")
  const isDeveco = createMemo(() => isDevecoProvider(local.model.current()?.providerID))

  const lastUserMessageId = createMemo(() => {
    const messages = sync.data.message[props.sessionID]
    if (!messages) return undefined
    return messages.findLast((m): m is UserMessage => m.role === "user")?.id
  })

  const [showTip, setShowTip] = createSignal(false)
  const [tipMounted, setTipMounted] = createSignal(false)
  const tipAlpha = createFadeIn(showTip, animationsEnabled)
  let tipTimer: ReturnType<typeof setTimeout> | undefined
  let unmountTimer: ReturnType<typeof setTimeout> | undefined
  let shownThisTurn = false

  function clearTimer() {
    if (tipTimer !== undefined) {
      clearTimeout(tipTimer)
      tipTimer = undefined
    }
  }

  createEffect(() => {
    const sType = statusType()
    const deveco = isDeveco()
    void lastUserMessageId()
    clearTimer()
    setShowTip(false)
    shownThisTurn = false

    if (sType !== "idle" && sType !== "retry" && deveco) {
      tipTimer = setTimeout(() => {
        if (!shownThisTurn) {
          setShowTip(true)
          shownThisTurn = true
        }
      }, 5_000)
    }
  })

  event.on("message.part.updated", (evt) => {
    if (evt.properties.part.sessionID !== props.sessionID) return
    clearTimer()
    setShowTip(false)
  })

  createEffect(() => {
    if (tipAlpha() > 0) {
      if (unmountTimer !== undefined) {
        clearTimeout(unmountTimer)
        unmountTimer = undefined
      }
      setTipMounted(true)
    } else if (tipMounted()) {
      unmountTimer = setTimeout(() => setTipMounted(false), 180)
    }
  })

  onCleanup(() => {
    clearTimer()
    if (unmountTimer !== undefined) clearTimeout(unmountTimer)
  })

  return (
    <Show when={tipMounted()}>
      <box flexDirection="row" gap={1} paddingLeft={3} paddingRight={2} maxWidth="100%">
        <text flexShrink={0} fg={fadeColor(theme.warning, tipAlpha())}>◉ </text>
        <text flexShrink={1} wrapMode="word" fg={fadeColor(theme.textMuted, tipAlpha())}>
          {t("prompt.slow_response_tip_before")}<span style={{ fg: fadeColor(theme.text, tipAlpha()) }}>/connect</span>{t("prompt.slow_response_tip_after")}
        </text>
      </box>
    </Show>
  )
}
