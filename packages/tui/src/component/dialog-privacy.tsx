import { createMemo } from "solid-js"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import open from "open"
import { useKV } from "@tui/context/kv"
import { AGREEMENT_DEFAULTS } from "deveco/cli/deveco-legal"

export function DialogPrivacy() {
  const dialog = useDialog()
  const kv = useKV()

  const analyticsEnabled = () => kv.get("analytics_enabled", true)

  const options = createMemo(() => [
    {
      title: "Privacy Policy",
      description: "Open Huawei privacy policy page",
      value: "policy",
      onSelect: () => {
        open(AGREEMENT_DEFAULTS.privacy_url).catch(() => {})
        dialog.clear()
      },
    },
    {
      title: "Terms of Use",
      description: "Open Huawei terms of use page",
      value: "terms",
      onSelect: () => {
        open(AGREEMENT_DEFAULTS.terms_url).catch(() => {})
        dialog.clear()
      },
    },
    {
      title: analyticsEnabled() ? "Disable Analytics" : "Enable Analytics",
      description: analyticsEnabled()
        ? "Turn off usage data collection"
        : "Turn on usage data collection",
      value: "toggle-analytics",
      onSelect: () => {
        const current = analyticsEnabled()
        kv.set("analytics_enabled", !current)
        dialog.clear()
      },
    },
  ])

  return <DialogSelect title="Privacy" options={options()} />
}