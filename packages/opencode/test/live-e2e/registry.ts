import llmBasicText from "./cases/llm-basic-text.case"
import planModeEnter from "./cases/plan-mode-enter.case"
import projectCreateDefaultApi from "./cases/project-create-default-api.case"
import configThirdPartyModels from "./cases/config-third-party-models.case"
import skillErrorInvalidImport from "./cases/skill-error-invalid-import.case"
import skillErrorTypeMismatch from "./cases/skill-error-type-mismatch.case"
import skillErrorSyntaxBracket from "./cases/skill-error-syntax-bracket.case"
import skillGrammarDiffQuery from "./cases/skill-grammar-diff-query.case"
import skillGrammarClassDef from "./cases/skill-grammar-class-def.case"
import skillGrammarTsToArkts from "./cases/skill-grammar-ts-to-arkts.case"
import skillArkuiBasicComponent from "./cases/skill-arkui-basic-component.case"
import skillArkuiComplexLayout from "./cases/skill-arkui-complex-layout.case"
import skillDevecoCreateHelloWorld from "./cases/skill-deveco-create-hello-world.case"
import skillDevecoApi17Fallback from "./cases/skill-deveco-api17-fallback.case"
import type { LiveTestCase } from "./types"

export const cases: LiveTestCase[] = [
  llmBasicText,
  planModeEnter,
  projectCreateDefaultApi,
  configThirdPartyModels,
  skillErrorInvalidImport,
  skillErrorTypeMismatch,
  skillErrorSyntaxBracket,
  skillGrammarDiffQuery,
  skillGrammarClassDef,
  skillGrammarTsToArkts,
  skillArkuiBasicComponent,
  skillArkuiComplexLayout,
  skillDevecoCreateHelloWorld,
  skillDevecoApi17Fallback,
]

export function getCaseByID(id: string) {
  return cases.find((item) => item.id === id)
}
