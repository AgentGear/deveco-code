import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { Auth } from "@/auth"

const BASE_URL = "https://cn.devecostudio.huawei.com/codeGenie/bigSearch"
const MAX_RESULT_LENGTH = 5 * 1024
export const KNOWLEDGE_TOOL_ID = "arkts_knowledge_search"

interface AnswerPrompt {
  prompt?: string
}

interface KnowledgeResult {
  code?: number
  desc?: string
  answer?: AnswerPrompt
}

interface KnowledgeResponseSuccess {
  code?: number
  body?: KnowledgeResult
}

interface KnowledgeResponseError {
  error_code?: number
  error_msg?: string
}

type KnowledgeResponse = KnowledgeResponseSuccess | KnowledgeResponseError

const Parameters = Schema.Struct({
  question: Schema.String.annotate({
    description:
      "A concise ArkTS/ArkUI/HarmonyOS/OpenHarmony question. Include key symbols, APIs, decorators, lifecycle names, build errors, symptoms, or URL-derived keywords.",
  }),
})

export const OhKnowledgeTool = Tool.define(KNOWLEDGE_TOOL_ID, Effect.gen(function* () {
  const auth = yield* Auth.Service
  return {
    description:
      "Search the official ArkTS / ArkUI / HarmonyOS / OpenHarmony knowledge base. MUST call this tool before answering questions about .ets code, ArkUI decorators or lifecycle, state refresh issues, HarmonyOS SDK APIs, DevEco/hvigor build errors, @kit.* or @ohos.* APIs, or HarmonyOS documentation URLs. For code snippets or URLs, extract the key symbols, APIs, errors, and observed symptom as the question.",
    parameters: Parameters,
    execute: (args: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
      Effect.gen(function* () {
        yield* ctx.ask({
          permission: KNOWLEDGE_TOOL_ID,
          patterns: [args.question],
          always: ["*"],
          metadata: {},
        })

        const authInfo = yield* auth.get("codegenie")
        if (!authInfo || authInfo.type !== "oauth") {
          throw new Error("Authorization fail: Please authorize to proceed.")
        }
        const accessToken = authInfo.access

        const request = {
          question: args.question,
        }

        const response = yield* Effect.tryPromise(() =>
          fetch(BASE_URL, {
            method: "POST",
            headers: {
              "Authorization": accessToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          })
        )

        const data: KnowledgeResponse = yield* Effect.tryPromise(() => response.json())

        // Check success response
        if ("code" in data && data.code === 200) {
          if (data.body?.answer?.prompt) {
            const mark = "【检索信息】："
            const prompt = data.body.answer.prompt
            const index = prompt.indexOf(mark)

            if (index != -1) {
              const result = prompt.substring(index + mark.length)
              const truncatedResult = result.slice(0, MAX_RESULT_LENGTH)
              return {
                title: "HarmonyOS knowledge Search",
                output: truncatedResult,
                metadata: {},
              }
            }
          }

          return {
            title: "HarmonyOS knowledge Search",
            output: "No answer found for question",
            metadata: {},
          }
        }

        if ("error_code" in data) {
          if (data.error_code === 4016) {
            throw new Error("Authorization fail: Please authorize to proceed.")
          }
          throw new Error(`Service error: ${data.error_msg || "Unknown error"}`)
        }
        throw new Error("Unknown response format from knowledge service")
      }).pipe(Effect.orDie),
  }
}))
