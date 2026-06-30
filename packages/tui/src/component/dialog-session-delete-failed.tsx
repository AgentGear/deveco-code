import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { createStore } from "solid-js/store"
import { For } from "solid-js"
import { useBindings } from "../keymap"
import { useI18n } from "../i18n"

export function DialogSessionDeleteFailed(props: {
  session: string
  workspace: string
  onDelete?: () => boolean | void | Promise<boolean | void>
  onRestore?: () => boolean | void | Promise<boolean | void>
  onDone?: () => void
}) {
  const dialog = useDialog()
  const { t } = useI18n()
  const { theme } = useTheme()
  const [store, setStore] = createStore({
    active: "delete" as "delete" | "restore",
  })

  const options = [
    {
      id: "delete" as const,
      title: t("dialog.delete_workspace"),
      description: t("dialog.delete_workspace_desc"),
      run: props.onDelete,
    },
    {
      id: "restore" as const,
      title: t("dialog.restore_new_workspace"),
      description: t("dialog.restore_new_workspace_desc"),
      run: props.onRestore,
    },
  ]

  async function confirm() {
    const result = await options.find((item) => item.id === store.active)?.run?.()
    if (result === false) return
    props.onDone?.()
    if (!props.onDone) dialog.clear()
  }

  useBindings(() => ({
    bindings: [
      { key: "return", desc: t("dialog.keybind_confirm_recovery_option"), group: t("category.dialog"), cmd: () => void confirm() },
      { key: "left", desc: t("dialog.keybind_delete_broken_session"), group: t("category.dialog"), cmd: () => setStore("active", "delete") },
      { key: "up", desc: t("dialog.keybind_delete_broken_session"), group: t("category.dialog"), cmd: () => setStore("active", "delete") },
      { key: "right", desc: t("dialog.keybind_restore_broken_session"), group: t("category.dialog"), cmd: () => setStore("active", "restore") },
      { key: "down", desc: t("dialog.keybind_restore_broken_session"), group: t("category.dialog"), cmd: () => setStore("active", "restore") },
    ],
  }))

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {t("dialog.title_failed_delete_session")}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          {t("dialog.esc")}
        </text>
      </box>
      <text fg={theme.textMuted} wrapMode="word">
        {t("dialog.failed_delete_session_desc", { session: props.session, workspace: props.workspace })}
      </text>
      <text fg={theme.textMuted} wrapMode="word">
        {t("dialog.choose_recovery_message")}
      </text>
      <box flexDirection="column" paddingBottom={1} gap={1}>
        <For each={options}>
          {(item) => (
            <box
              flexDirection="column"
              paddingLeft={1}
              paddingRight={1}
              paddingTop={1}
              paddingBottom={1}
              backgroundColor={item.id === store.active ? theme.primary : undefined}
              onMouseUp={() => {
                setStore("active", item.id)
                void confirm()
              }}
            >
              <text
                attributes={TextAttributes.BOLD}
                fg={item.id === store.active ? theme.selectedListItemText : theme.text}
              >
                {item.title}
              </text>
              <text fg={item.id === store.active ? theme.selectedListItemText : theme.textMuted} wrapMode="word">
                {item.description}
              </text>
            </box>
          )}
        </For>
      </box>
    </box>
  )
}
