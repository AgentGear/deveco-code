import { describe, expect, test } from "bun:test"
import { dict as en } from "@/i18n/en"
import { dict as zh } from "@/i18n/zh"
import { showTypeToFilterHint } from "./slash-popover"

describe("showTypeToFilterHint", () => {
  test("shows when popover is @ and filter is empty", () => {
    expect(showTypeToFilterHint("at", "")).toBe(true)
    expect(showTypeToFilterHint("at", undefined)).toBe(true)
  })

  test("hides when user has typed a filter", () => {
    expect(showTypeToFilterHint("at", "a")).toBe(false)
    expect(showTypeToFilterHint("at", "main")).toBe(false)
  })

  test("hides when popover is /", () => {
    expect(showTypeToFilterHint("slash", "")).toBe(false)
    expect(showTypeToFilterHint("slash", undefined)).toBe(false)
  })

  test("hides when popover is closed", () => {
    expect(showTypeToFilterHint(null, "")).toBe(false)
    expect(showTypeToFilterHint(null, undefined)).toBe(false)
  })
})

describe("prompt.popover.typeToFilter i18n key", () => {
  test("english translation is non-empty and starts with 'Type to filter'", () => {
    expect(en["prompt.popover.typeToFilter"]).toBeDefined()
    expect(en["prompt.popover.typeToFilter"]).toMatch(/^Type to filter/)
  })

  test("chinese translation is non-empty and mentions 输入", () => {
    expect(zh["prompt.popover.typeToFilter"]).toBeDefined()
    expect(zh["prompt.popover.typeToFilter"]).toContain("输入")
  })

  test("english and chinese translations are different", () => {
    expect(en["prompt.popover.typeToFilter"]).not.toBe(zh["prompt.popover.typeToFilter"])
  })
})