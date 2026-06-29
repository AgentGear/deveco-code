import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createMemo, For, type Accessor } from "solid-js"
import { DEFAULT_THEMES, useTheme } from "../../context/theme"
import { useCommandShortcut } from "../../keymap"
import { useI18n } from "../../i18n"

const themeCount = Object.keys(DEFAULT_THEMES).length

type TipPart = { text: string; highlight: boolean }
type TipShortcut = Accessor<string>
type Shortcuts = {
  agentCycle: TipShortcut
  childFirst: TipShortcut
  childNext: TipShortcut
  childPrevious: TipShortcut
  commandList: TipShortcut
  editorOpen: TipShortcut
  helpOpen: TipShortcut
  inputClear: TipShortcut
  inputNewline: TipShortcut
  inputPaste: TipShortcut
  inputUndo: TipShortcut
  leader: TipShortcut
  messagesCopy: TipShortcut
  messagesFirst: TipShortcut
  messagesLast: TipShortcut
  messagesPageDown: TipShortcut
  messagesPageUp: TipShortcut
  messagesToggleConceal: TipShortcut
  modelCycleRecent: TipShortcut
  modelList: TipShortcut
  sessionExport: TipShortcut
  sessionInterrupt: TipShortcut
  sessionList: TipShortcut
  sessionNew: TipShortcut
  sessionParent: TipShortcut
  sessionPinToggle: TipShortcut
  sessionQuickSwitch1: TipShortcut
  sessionQuickSwitch9: TipShortcut
  sessionSidebarToggle: TipShortcut
  sessionTimeline: TipShortcut
  statusView: TipShortcut
  terminalSuspend: TipShortcut
  themeList: TipShortcut
}
type TipFn = (shortcuts: Shortcuts, t: (key: string, options?: Record<string, unknown>) => string) => string | undefined
type Tip = string | TipFn

function parse(tip: string): TipPart[] {
  const parts: TipPart[] = []
  const regex = /\{highlight\}(.*?)\{\/highlight\}/g
  const found = Array.from(tip.matchAll(regex))
  const state = found.reduce(
    (acc, match) => {
      const start = match.index ?? 0
      if (start > acc.index) {
        acc.parts.push({ text: tip.slice(acc.index, start), highlight: false })
      }
      acc.parts.push({ text: match[1], highlight: true })
      acc.index = start + match[0].length
      return acc
    },
    { parts, index: 0 },
  )

  if (state.index < tip.length) {
    parts.push({ text: tip.slice(state.index), highlight: false })
  }

  return parts
}

function shortcutText(value: string) {
  return `{highlight}${value}{/highlight}`
}

function commandText(command: string, shortcut: string, t: (key: string) => string, textKey: string) {
  if (!shortcut) return shortcutText(command)
  return `${shortcutText(command)}${t("tip.or")}${shortcutText(shortcut)} ${t(textKey)}`
}

function press(shortcut: string, t: (key: string) => string, textKey: string) {
  if (!shortcut) return undefined
  return `${t("tip.press")}${shortcutText(shortcut)} ${t(textKey)}`
}

function configShortcut(api: TuiPluginApi, command: string): TipShortcut {
  return () =>
    api.tuiConfig.keybinds
      .get(command)
      .map((binding) => api.keys.formatSequence(Array.from(api.keymap.parseKeySequence(binding.key))))
      .filter(Boolean)
      .join(", ")
}

export function Tips(props: { api: TuiPluginApi; connected?: boolean }) {
  const theme = useTheme().theme
  const { t } = useI18n()
  const tipOffset = Math.random()
  const shortcuts: Shortcuts = {
    agentCycle: useCommandShortcut("agent.cycle"),
    childFirst: configShortcut(props.api, "session.child.first"),
    childNext: configShortcut(props.api, "session.child.next"),
    childPrevious: configShortcut(props.api, "session.child.previous"),
    commandList: useCommandShortcut("command.palette.show"),
    editorOpen: useCommandShortcut("prompt.editor"),
    helpOpen: useCommandShortcut("help.open"),
    inputClear: useCommandShortcut("prompt.clear"),
    inputNewline: useCommandShortcut("input.newline"),
    inputPaste: useCommandShortcut("prompt.paste"),
    inputUndo: useCommandShortcut("input.undo"),
    leader: configShortcut(props.api, "leader"),
    messagesCopy: configShortcut(props.api, "messages.copy"),
    messagesFirst: configShortcut(props.api, "session.first"),
    messagesLast: configShortcut(props.api, "session.last"),
    messagesPageDown: configShortcut(props.api, "session.page.down"),
    messagesPageUp: configShortcut(props.api, "session.page.up"),
    messagesToggleConceal: configShortcut(props.api, "session.toggle.conceal"),
    modelCycleRecent: useCommandShortcut("model.cycle_recent"),
    modelList: useCommandShortcut("model.list"),
    sessionExport: configShortcut(props.api, "session.export"),
    sessionInterrupt: configShortcut(props.api, "session.interrupt"),
    sessionList: useCommandShortcut("session.list"),
    sessionNew: useCommandShortcut("session.new"),
    sessionParent: configShortcut(props.api, "session.parent"),
    sessionPinToggle: configShortcut(props.api, "session.pin.toggle"),
    sessionQuickSwitch1: useCommandShortcut("session.quick_switch.1"),
    sessionQuickSwitch9: useCommandShortcut("session.quick_switch.9"),
    sessionSidebarToggle: configShortcut(props.api, "session.sidebar.toggle"),
    sessionTimeline: configShortcut(props.api, "session.timeline"),
    statusView: useCommandShortcut("opencode.status"),
    terminalSuspend: useCommandShortcut("terminal.suspend"),
    themeList: useCommandShortcut("theme.switch"),
  }
  const tip = createMemo(() => {
    if (props.connected === false) return t("tip.no_models")
    const tips = [...TIPS, process.platform !== "win32" ? TERMINAL_SUSPEND_TIP : INPUT_UNDO_TIP].flatMap((item) => {
      const value = typeof item === "string" ? t(item) : item(shortcuts, t)
      return value ? [value] : []
    })
    return tips[Math.floor(tipOffset * tips.length)] ?? t("tip.no_models")
  }, t("tip.no_models"))
  // Solid can expose a memo's initial value while a pure computation is pending.
  const noModelsParts = createMemo(() => parse(t("tip.no_models")))
  const parts = createMemo(() => {
    const value = tip()
    if (typeof value === "string") return parse(value)
    return noModelsParts()
  })

  return (
    <box flexDirection="row" maxWidth="100%">
      <text flexShrink={0} style={{ fg: theme.warning }}>
        {t("tip.label")}{" "}
      </text>
      <text flexShrink={1} wrapMode="word">
        <For each={parts()}>
          {(part) => <span style={{ fg: part.highlight ? theme.text : theme.textMuted }}>{part.text}</span>}
        </For>
      </text>
    </box>
  )
}

const TIPS: Tip[] = [
  "tip.0",
  "tip.1",
  (shortcuts, t) => press(shortcuts.agentCycle(), t, "tip.2"),
  "tip.3",
  "tip.4",
  "tip.5",
  (shortcuts, t) => press(shortcuts.inputPaste(), t, "tip.6"),
  (shortcuts, t) => `${t("tip.use")} ${commandText("/editor", shortcuts.editorOpen(), t, "tip.7")}`,
  "tip.8",
  (shortcuts, t) => `${t("tip.use")} ${commandText("/models", shortcuts.modelList(), t, "tip.9")}`,
  (shortcuts, t) => `${t("tip.use")} ${commandText("/themes", shortcuts.themeList(), t, "tip.10")}`,
  (shortcuts, t) => `${t("tip.use")} ${commandText("/new", shortcuts.sessionNew(), t, "tip.11")}`,
  (shortcuts, t) => `${t("tip.use")} ${commandText("/sessions", shortcuts.sessionList(), t, "tip.12")}`,
  (shortcuts, t) => press(shortcuts.sessionPinToggle(), t, "tip.13"),
  (shortcuts, t) =>
    shortcuts.sessionQuickSwitch1() && shortcuts.sessionQuickSwitch9()
      ? t("tip.14", { first: shortcuts.sessionQuickSwitch1(), last: shortcuts.sessionQuickSwitch9() })
      : undefined,
  "tip.15",
  (shortcuts, t) => `${t("tip.use")} ${commandText("/export", shortcuts.sessionExport(), t, "tip.16")}`,
  (shortcuts, t) => press(shortcuts.messagesCopy(), t, "tip.17"),
  (shortcuts, t) => press(shortcuts.commandList(), t, "tip.18"),
  "tip.19",
  (shortcuts, t) => t("tip.20", { key: shortcuts.leader() }),
  (shortcuts, t) => press(shortcuts.modelCycleRecent(), t, "tip.21"),
  (shortcuts, t) => press(shortcuts.sessionSidebarToggle(), t, "tip.22"),
  (shortcuts, t) =>
    shortcuts.messagesPageUp() && shortcuts.messagesPageDown()
      ? `${t("tip.use")} ${shortcutText(shortcuts.messagesPageUp())}/${shortcutText(shortcuts.messagesPageDown())} ${t("tip.23")}`
      : undefined,
  (shortcuts, t) => press(shortcuts.messagesFirst(), t, "tip.24"),
  (shortcuts, t) => press(shortcuts.messagesLast(), t, "tip.25"),
  (shortcuts, t) => press(shortcuts.inputNewline(), t, "tip.26"),
  (shortcuts, t) => press(shortcuts.inputClear(), t, "tip.27"),
  (shortcuts, t) => press(shortcuts.sessionInterrupt(), t, "tip.28"),
  "tip.29",
  "tip.30",
  (shortcuts, t) => {
    const items = [
      shortcuts.sessionParent(),
      shortcuts.childFirst(),
      shortcuts.childPrevious(),
      shortcuts.childNext(),
    ].filter(Boolean)
    if (!items.length) return undefined
    return `${t("tip.use")} ${items.map(shortcutText).join(" / ")} ${t("tip.31")}`
  },
  "tip.32",
  "tip.33",
  "tip.34",
  "tip.35",
  "tip.36",
  "tip.37",
  "tip.38",
  "tip.39",
  "tip.40",
  "tip.41",
  "tip.42",
  "tip.43",
  "tip.44",
  "tip.45",
  "tip.46",
  "tip.47",
  "tip.48",
  "tip.49",
  "tip.50",
  "tip.51",
  "tip.52",
  "tip.53",
  "tip.54",
  "tip.55",
  "tip.56",
  "tip.57",
  "tip.58",
  "tip.59",
  "tip.60",
  "tip.61",
  "tip.62",
  "tip.63",
  "tip.64",
  "tip.65",
  "tip.66",
  "tip.67",
  "tip.68",
  "tip.69",
  "tip.70",
  "tip.71",
  "tip.72",
  "tip.73",
  "tip.74",
  "tip.75",
  "tip.76",
  "tip.77",
  "tip.78",
  "tip.79",
  "tip.80",
  (shortcuts, t) => `${t("tip.use")} ${commandText("/timeline", shortcuts.sessionTimeline(), t, "tip.81")}`,
  (shortcuts, t) => press(shortcuts.messagesToggleConceal(), t, "tip.82"),
  (shortcuts, t) => `${t("tip.use")} ${commandText("/status", shortcuts.statusView(), t, "tip.83")}`,
  "tip.84",
  (shortcuts, t) =>
    shortcuts.commandList()
      ? t("tip.85", { key: shortcuts.commandList() })
      : t("tip.85_plain"),
  "tip.86",
  "tip.87",
  "tip.88",
  (shortcuts, t) => `${t("tip.use")} ${commandText("/help", shortcuts.helpOpen(), t, "tip.89")}`,
  "tip.90",
]

const INPUT_UNDO_TIP: Tip = (shortcuts, t) => press(shortcuts.inputUndo(), t, "tip.91")
const TERMINAL_SUSPEND_TIP: Tip = (shortcuts, t) =>
  press(shortcuts.terminalSuspend(), t, "tip.92")
