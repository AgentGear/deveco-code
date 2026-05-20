import { describe, expect, test } from "bun:test"
import {
  normalizeSectionTitle,
  matchesSection,
  matchesFieldLabel,
} from "@/tool/document-validation/section-normalizer"

describe("normalizeSectionTitle", () => {
  test("removes bold markers", () => {
    expect(normalizeSectionTitle("**Title**")).toBe("Title")
  })

  test("converts fullwidth spaces", () => {
    expect(normalizeSectionTitle("Title　with　spaces")).toBe("Title with spaces")
  })

  test("converts fullwidth colons", () => {
    expect(normalizeSectionTitle("Title：value")).toBe("Title:value")
  })

  test("collapses multiple spaces", () => {
    expect(normalizeSectionTitle("Title    with   spaces")).toBe("Title with spaces")
  })

  test("trims whitespace", () => {
    expect(normalizeSectionTitle("  Title  ")).toBe("Title")
  })

  test("removes parenthetical star markers", () => {
    expect(normalizeSectionTitle("Title *(optional)*")).toBe("Title")
    expect(normalizeSectionTitle("Title*(required)*")).toBe("Title")
  })
})

describe("matchesSection", () => {
  test("matches exact title", () => {
    expect(matchesSection("Requirements", ["Requirements"])).toBeTrue()
  })

  test("matches case-insensitively", () => {
    expect(matchesSection("requirements", ["Requirements"])).toBeTrue()
  })

  test("matches after normalization", () => {
    expect(matchesSection("**Requirements**", ["Requirements"])).toBeTrue()
  })

  test("returns false for non-match", () => {
    expect(matchesSection("Other", ["Requirements"])).toBeFalse()
  })
})

describe("matchesFieldLabel", () => {
  test("matches simple label", () => {
    expect(matchesFieldLabel("Status: Draft", ["Status"])).toBeTrue()
  })

  test("matches with dash prefix", () => {
    expect(matchesFieldLabel("- Status: Draft", ["Status"])).toBeTrue()
  })

  test("matches with star prefix", () => {
    expect(matchesFieldLabel("* Status: Draft", ["Status"])).toBeTrue()
  })

  test("matches with bold markers", () => {
    expect(matchesFieldLabel("**Status**: Draft", ["Status"])).toBeTrue()
  })

  test("does not match without colon", () => {
    expect(matchesFieldLabel("Status Draft", ["Status"])).toBeFalse()
  })

  test("handles regex special characters in candidate", () => {
    expect(matchesFieldLabel("Price ($): 100", ["Price ($)"])).toBeTrue()
    expect(matchesFieldLabel("Version [v1]: 2.0", ["Version [v1]"])).toBeTrue()
    expect(matchesFieldLabel("Path C:\\Users: ok", ["Path C:\\Users"])).toBeTrue()
  })
})
