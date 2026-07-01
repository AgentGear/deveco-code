import { createMemo } from "solid-js"
import { useLocal } from "../context/local"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useI18n } from "../i18n"

export function DialogAgent() {
  const { t } = useI18n()
  const local = useLocal()
  const dialog = useDialog()

  const options = createMemo(() =>
    local.agent.list().map((item) => {
      return {
        value: item.name,
        title: item.name,
        description: item.description?.trim() || (item.native ? t("dialog.agent_native") : undefined),
      }
    }),
  )

  return (
    <DialogSelect
      title={t("dialog.select_agent")}
      current={local.agent.current()?.name}
      options={options()}
      onSelect={(option) => {
        local.agent.set(option.value)
        dialog.clear()
      }}
    />
  )
}
