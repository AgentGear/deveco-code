import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useI18n, changeLanguage, currentLanguage } from "../i18n"
import { useKV } from "../context/kv"

export function DialogLanguage() {
  const { t } = useI18n()
  const dialog = useDialog()
  const kv = useKV()
  const initial = currentLanguage()

  const options = [
    { title: t("dialog.language_english"), value: "en" },
    { title: t("dialog.language_chinese"), value: "zh" },
  ]

  return (
    <DialogSelect
      title={t("dialog.language_select_title")}
      options={options}
      current={initial}
      onSelect={(opt) => {
        void changeLanguage(opt.value).then(() => {
          kv.set("language", opt.value)
        })
        dialog.clear()
      }}
      skipFilter
    />
  )
}
