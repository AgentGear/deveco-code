import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "./dialog"
import { useBindings, useCommandShortcut } from "../keymap"
import { useI18n } from "../i18n"

export function DialogHelp() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const { t } = useI18n()
  const commandShortcut = useCommandShortcut("command.palette.show")

  useBindings(() => ({
    bindings: [
      { key: "return", desc: t("dialog.close_help"), group: t("category.dialog"), cmd: () => dialog.clear() },
      { key: "escape", desc: t("dialog.close_help"), group: t("category.dialog"), cmd: () => dialog.clear() },
    ],
  }))

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {t("dialog.title_help")}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          {t("dialog.esc_enter")}
        </text>
      </box>
      <box paddingBottom={1}>
        <text fg={theme.textMuted}>
          {t("dialog.help_message", { key: commandShortcut() })}
        </text>
      </box>
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        <box paddingLeft={3} paddingRight={3} backgroundColor={theme.primary} onMouseUp={() => dialog.clear()}>
          <text fg={theme.selectedListItemText}>{t("dialog.action_ok")}</text>
        </box>
      </box>
    </box>
  )
}
