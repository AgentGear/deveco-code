import { DialogSelect } from "../../ui/dialog-select"
import { useRoute } from "../../context/route"
import { useI18n } from "../../i18n"

export function DialogSubagent(props: { sessionID: string }) {
  const { t } = useI18n()
  const route = useRoute()

  return (
    <DialogSelect
      title={t("dialog.title_subagent_actions")}
      options={[
        {
          title: t("dialog.action_open"),
          value: "subagent.view",
          description: t("dialog.desc_subagent_session"),
          onSelect: (dialog) => {
            route.navigate({
              type: "session",
              sessionID: props.sessionID,
            })
            dialog.clear()
          },
        },
      ]}
    />
  )
}
