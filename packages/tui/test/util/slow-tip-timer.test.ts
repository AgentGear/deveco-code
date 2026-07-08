import { expect, test } from "bun:test"
import { isDevecoProvider } from "../../src/util/model"

test("returns true for deveco provider ID", () => {
  expect(isDevecoProvider("deveco")).toBe(true)
})

test("returns false for non-deveco provider IDs", () => {
  expect(isDevecoProvider("openai")).toBe(false)
  expect(isDevecoProvider("opencode")).toBe(false)
  expect(isDevecoProvider("anthropic")).toBe(false)
})

test("returns false for undefined provider ID", () => {
  expect(isDevecoProvider(undefined)).toBe(false)
})

test("returns false for empty string", () => {
  expect(isDevecoProvider("")).toBe(false)
})
