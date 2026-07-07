import llmBasicText from "./cases/llm-basic-text.case"
import planModeEnter from "./cases/plan-mode-enter.case"
import type { LiveTestCase } from "./types"

export const cases: LiveTestCase[] = [llmBasicText, planModeEnter]

export function getCaseByID(id: string) {
  return cases.find((item) => item.id === id)
}
