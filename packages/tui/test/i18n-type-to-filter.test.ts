import { describe, expect, test } from "bun:test"
import en from "../src/i18n/en.json"
import zh from "../src/i18n/zh.json"

describe("prompt.popover.typeToFilter i18n key (TUI)", () => {
  test("english translation exists and starts with 'Type to filter'", () => {
    expect(en.prompt?.popover?.typeToFilter).toBeDefined()
    expect(en.prompt.popover.typeToFilter).toMatch(/^Type to filter/)
  })

  test("chinese translation exists and contains 输入", () => {
    expect(zh.prompt?.popover?.typeToFilter).toBeDefined()
    expect(zh.prompt.popover.typeToFilter).toContain("输入")
  })

  test("english and chinese translations are different", () => {
    expect(en.prompt.popover.typeToFilter).not.toBe(zh.prompt.popover.typeToFilter)
  })
})