import { describe, expect, test } from "bun:test"
import { validateDocumentSimple } from "@/tool/document-validation/document-validate-tool"
import * as path from "path"

describe("Integration: validate existing SDD templates", () => {
  const templatesDir = path.resolve(__dirname, "../../../resources/spec/templates")

  test("spec-template.md should be a valid spec document", () => {
    const filePath = path.join(templatesDir, "spec-template.md")
    const result = validateDocumentSimple(filePath, "spec")
    expect(result).toBe("")
  })

  test("plan-template.md should be a valid design document", () => {
    const filePath = path.join(templatesDir, "plan-template.md")
    const result = validateDocumentSimple(filePath, "design")
    expect(result).toBe("")
  })

  test("tasks-template.md should be a valid tasks document", () => {
    const filePath = path.join(templatesDir, "tasks-template.md")
    const result = validateDocumentSimple(filePath, "tasks")
    expect(result).toBe("")
  })
})
