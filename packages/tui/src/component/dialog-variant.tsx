import { createMemo } from "solid-js"
import { useLocal } from "../context/local"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useI18n } from "../i18n"

export function DialogVariant() {
  const { t } = useI18n()
  const local = useLocal()
  const dialog = useDialog()

  const options = createMemo(() => {
    return [
      {
        value: "default",
        title: t("dialog.default"),
        onSelect: () => {
          dialog.clear()
          local.model.variant.set(undefined)
        },
      },
      ...local.model.variant.list().map((variant) => ({
        value: variant,
        title: variant,
        onSelect: () => {
          dialog.clear()
          local.model.variant.set(variant)
        },
      })),
    ]
  })

  return (
    <DialogSelect<string>
      options={options()}
      title={t("dialog.select_variant")}
      current={local.model.variant.selected()}
      flat={true}
    />
  )
}
