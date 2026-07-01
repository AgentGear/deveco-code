import type { TuiPlugin, TuiPluginApi, TuiPluginStatus } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { useTerminalDimensions } from "@opentui/solid"
import { fileURLToPath } from "url"
import { DialogSelect, type DialogSelectOption } from "../../ui/dialog-select"
import { Show, createEffect, createMemo, createSignal } from "solid-js"
import { useBindings } from "../../keymap"
import { onLanguageChange, useI18n } from "../../i18n"
import i18next from "i18next"

const id = "internal:plugin-manager"

function state(api: TuiPluginApi, item: TuiPluginStatus) {
  const { t } = useI18n()
  if (!item.enabled) {
    return <span style={{ fg: api.theme.current.textMuted }}>{t("plugin.disabled")}</span>
  }

  return (
    <span style={{ fg: item.active ? api.theme.current.success : api.theme.current.error }}>
      {item.active ? t("plugin.active") : t("plugin.inactive")}
    </span>
  )
}

function source(spec: string) {
  if (!spec.startsWith("file://")) return
  return fileURLToPath(spec)
}

function meta(item: TuiPluginStatus, width: number) {
  const { t } = useI18n()
  if (item.source === "internal") {
    if (width >= 120) return t("plugin.built_in")
    return t("plugin.built_in_short")
  }
  const next = source(item.spec)
  if (next) return next
  return item.spec
}

function Install(props: { api: TuiPluginApi }) {
  const { t } = useI18n()
  const [global, setGlobal] = createSignal(false)
  const [busy, setBusy] = createSignal(false)

  useBindings(() => ({
    enabled: !busy(),
    bindings: [{ key: "tab", desc: t("plugin.keybind_toggle_install_scope"), group: t("category.plugins"), cmd: () => setGlobal((value) => !value) }],
  }))

  return (
    <props.api.ui.DialogPrompt
      title={t("command.plugin_install")}
      placeholder={t("plugin.placeholder_npm_package")}
      busy={busy()}
      busyText={t("plugin.installing")}
      description={() => (
        <box flexDirection="row" gap={1}>
          <text fg={props.api.theme.current.textMuted}>{t("plugin.scope_label")}</text>
          <text fg={busy() ? props.api.theme.current.textMuted : props.api.theme.current.text}>
            {global() ? t("plugin.scope_global") : t("plugin.scope_local")}
          </text>
          <Show when={!busy()}>
            <text fg={props.api.theme.current.textMuted}>{t("plugin.tab_toggle_hint")}</text>
          </Show>
        </box>
      )}
      onConfirm={(raw) => {
        if (busy()) return
        const mod = raw.trim()
        if (!mod) {
          props.api.ui.toast({
            variant: "error",
            message: t("plugin.package_name_required"),
          })
          return
        }

        setBusy(true)
        void props.api.plugins
          .install(mod, { global: global() })
          .then((out) => {
            if (!out.ok) {
              props.api.ui.toast({
                variant: "error",
                message: out.message,
              })
              if (out.missing) {
                props.api.ui.toast({
                  variant: "info",
                  message: t("plugin.check_registry_auth"),
                })
              }
              show(props.api)
              return
            }

            props.api.ui.toast({
              variant: "success",
              message: t("plugin.installed_at", { mod, scope: global() ? t("plugin.scope_global") : t("plugin.scope_local"), dir: out.dir }),
            })
            if (!out.tui) {
              props.api.ui.toast({
                variant: "info",
                message: t("plugin.no_tui_target"),
              })
              show(props.api)
              return
            }

            return props.api.plugins.add(mod).then((ok) => {
              if (!ok) {
                props.api.ui.toast({
                  variant: "warning",
                  message: t("plugin.runtime_load_failed"),
                })
                show(props.api)
                return
              }

              props.api.ui.toast({
                variant: "success",
                message: t("plugin.loaded_in_session", { mod }),
              })
              show(props.api)
            })
          })
          .finally(() => {
            setBusy(false)
          })
      }}
      onCancel={() => {
        show(props.api)
      }}
    />
  )
}

function row(t: (key: string) => string, api: TuiPluginApi, item: TuiPluginStatus, width: number): DialogSelectOption<string> {
  return {
    title: item.id,
    value: item.id,
    category: item.source === "internal" ? t("category.plugin_internal") : t("category.plugin_external"),
    description: meta(item, width),
    footer: state(api, item),
    disabled: item.id === id,
  }
}

function showInstall(api: TuiPluginApi) {
  api.ui.dialog.replace(() => <Install api={api} />)
}

function View(props: { api: TuiPluginApi }) {
  const { t } = useI18n()
  const size = useTerminalDimensions()
  const [list, setList] = createSignal(props.api.plugins.list())
  const [cur, setCur] = createSignal<string | undefined>()
  const [lock, setLock] = createSignal(false)

  createEffect(() => {
    const width = size().width
    if (width >= 128) {
      props.api.ui.dialog.setSize("xlarge")
      return
    }
    if (width >= 96) {
      props.api.ui.dialog.setSize("large")
      return
    }
    props.api.ui.dialog.setSize("medium")
  })

  const rows = createMemo(() =>
    [...list()]
      .sort((a, b) => {
        const x = a.source === "internal" ? 1 : 0
        const y = b.source === "internal" ? 1 : 0
        if (x !== y) return x - y
        return a.id.localeCompare(b.id)
      })
      .map((item) => row(t, props.api, item, size().width)),
  )

  const flip = (x: string) => {
    if (lock()) return
    const item = list().find((entry) => entry.id === x)
    if (!item) return
    setLock(true)
    const task = item.active ? props.api.plugins.deactivate(x) : props.api.plugins.activate(x)
    void task
      .then((ok) => {
        if (!ok) {
          props.api.ui.toast({
            variant: "error",
            message: t("plugin.update_failed", { id: item.id }),
          })
        }
        setList(props.api.plugins.list())
      })
      .finally(() => {
        setLock(false)
      })
  }

  return (
    <DialogSelect
      title={t("command.plugin_list")}
      options={rows()}
      current={cur()}
      onMove={(item) => setCur(item.value)}
      actions={[
        {
          title: t("command.plugin_toggle"),
          command: "plugins.toggle",
          hidden: lock(),
          onTrigger: (item) => {
            setCur(item.value)
            flip(item.value)
          },
        },
        {
          title: t("command.plugin_install"),
          command: "dialog.plugins.install",
          hidden: lock(),
          onTrigger: () => {
            showInstall(props.api)
          },
        },
      ]}
      onSelect={(item) => {
        setCur(item.value)
        flip(item.value)
      }}
    />
  )
}

function show(api: TuiPluginApi) {
  api.ui.dialog.replace(() => <View api={api} />)
}

const tui: TuiPlugin = async (api) => {
  const registerKeymap = () =>
    api.keymap.registerLayer({
      commands: [
        {
          name: "plugins.list",
          title: i18next.t("command.plugin_list"),
          category: i18next.t("category.system"),
          namespace: "palette",
          run() {
            show(api)
          },
        },
        {
          name: "plugins.install",
          title: i18next.t("command.plugin_install"),
          category: i18next.t("category.system"),
          namespace: "palette",
          run() {
            showInstall(api)
          },
        },
      ],
      bindings: api.tuiConfig.keybinds.gather("plugins.palette", ["plugins.list", "plugins.install"]),
    })

  let unregisterLayer = registerKeymap()
  onLanguageChange(() => {
    unregisterLayer()
    unregisterLayer = registerKeymap()
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
