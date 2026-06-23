import { describe, expect, test } from "bun:test"
import { readSource } from "./lib/source-reader"

const APP_FILES: Array<{ file: string; path: string }> = [
  { file: "session-header.tsx", path: "packages/app/src/components/session/session-header.tsx" },
  { file: "session-side-panel.tsx", path: "packages/app/src/pages/session/session-side-panel.tsx" },
  { file: "use-session-commands.tsx", path: "packages/app/src/pages/session/use-session-commands.tsx" },
  { file: "titlebar.tsx", path: "packages/app/src/components/titlebar.tsx" },
]

describe("App VITE_DEVECO_CHANNEL regression guards", () => {
  for (const { file, path } of APP_FILES) {
    test(`${file}: references VITE_DEVECO_CHANNEL`, () => {
      const source = readSource(path)
      expect(source).toContain("VITE_DEVECO_CHANNEL")
    })
  }

  test("sidebar-items.tsx defines DEVECO_PROJECT_ID constant", () => {
    const source = readSource("packages/app/src/pages/layout/sidebar-items.tsx")
    expect(source).toMatch(/DEVECO_PROJECT_ID/)
  })

  test("titlebar.tsx uses VITE_DEVECO_CHANNEL for channel badge display", () => {
    const source = readSource("packages/app/src/components/titlebar.tsx")
    expect(source).toMatch(/VITE_DEVECO_CHANNEL/)
  })

  test("session-header.tsx uses VITE_DEVECO_CHANNEL for beta detection", () => {
    const source = readSource("packages/app/src/components/session/session-header.tsx")
    expect(source).toMatch(/VITE_DEVECO_CHANNEL.*beta/)
  })
})
