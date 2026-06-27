import i18next from "i18next"
import { createContext, useContext, createSignal, onMount, Show } from "solid-js"
import en from "./en.json" with { type: "json" }
import zh from "./zh.json" with { type: "json" }
import { useKV } from "../context/kv"

void i18next.init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  interpolation: { escapeValue: false },
})

const I18nContext = createContext<{ t: typeof i18next.t; lng: () => string }>()

export function I18nProvider(props: { children: any }) {
  const kv = useKV()
  const [lng, setLng] = createSignal(i18next.language)
  const [ready, setReady] = createSignal(false)

  i18next.on("languageChanged", (language: string) => setLng(language))

  onMount(() => {
    const saved = kv.get("language", "en")
    if (saved !== i18next.language) void i18next.changeLanguage(saved)
    setReady(true)
  })

  const t = ((key: string, options?: any) => {
    lng()
    return i18next.t(key, options)
  }) as typeof i18next.t

  return (
    <Show when={ready()}>
      <I18nContext.Provider value={{ t, lng }}>
        {props.children}
      </I18nContext.Provider>
    </Show>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("I18n context must be used within I18nProvider")
  return ctx
}

export async function changeLanguage(language: string) {
  await i18next.changeLanguage(language)
}

export function currentLanguage() {
  return i18next.language
}

export function onLanguageChange(callback: (language: string) => void) {
  i18next.on("languageChanged", callback)
}
