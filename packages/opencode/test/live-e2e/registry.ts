import llmBasicText from "./cases/llm-basic-text.case"
import type { LiveTestCase } from "./types"

export const cases: LiveTestCase[] = [llmBasicText]

export function getCaseByID(id: string) {
  return cases.find((item) => item.id === id)
}
