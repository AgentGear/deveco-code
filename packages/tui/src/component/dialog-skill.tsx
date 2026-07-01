import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { createResource, createMemo } from "solid-js"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"
import { useI18n } from "../i18n"

export type DialogSkillProps = {
  onSelect: (skill: string) => void
}

export function DialogSkill(props: DialogSkillProps) {
  const { t } = useI18n()
  const dialog = useDialog()
  const sdk = useSDK()
  dialog.setSize("large")

  const [skills] = createResource(async () => {
    const result = await sdk.client.app.skills()
    return result.data ?? []
  })

  const options = createMemo<DialogSelectOption<string>[]>(() => {
    const list = skills() ?? []
    const maxWidth = Math.max(0, ...list.map((s) => s.name.length))
    return list.map((skill) => ({
      title: skill.name.padEnd(maxWidth),
      description: skill.description?.replace(/\s+/g, " ").trim(),
      value: skill.name,
      category: t("category.skills"),
      onSelect: () => {
        props.onSelect(skill.name)
        dialog.clear()
      },
    }))
  })

  return (
    <DialogSelect
      title={t("dialog.title_skills")}
      placeholder={t("dialog.placeholder_search_skills")}
      options={options()}
    />
  )
}
