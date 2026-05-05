import { Session } from "@/session/session"
import { SessionID, MessageID, PartID } from "./schema"
import { Effect } from "effect"
import * as Log from "@opencode-ai/core/util/log"
import { KNOWLEDGE_TOOL_ID } from "@/tool/oh_knowledge.ts"

const log = Log.create({service: "knowledge"})

type OhKnowledgeResult = {
  title: string
  output: string
  metadata: Record<string, any>
}

type OhKnowledgeState = {
  result: OhKnowledgeResult | null
  callID: string | null
  userInput: string
  pending: boolean
}

const state: OhKnowledgeState = {
  result: null,
  callID: null,
  userInput: "",
  pending: false,
}

export namespace OhKnowledgeAsync {
  export function trigger(
    userInput: string,
    callId: string,
    execute: () => Promise<OhKnowledgeResult>
  ): void {
    state.result = null
    state.callID = callId
    state.userInput = userInput
    state.pending = true
    execute()
      .then((result) => {
        if (result?.output && result.output.trim() && result.output !== "No answer found for question") {
          state.result = result
        }
        state.pending = false
      })
      .catch((err) => {
        log.error("oh_knowledge async error:", { err })
        state.pending = false
      })
  }

  export function inject(
    sessions: Session.Interface,
    sessionID: SessionID,
    messageID: MessageID
  ): Effect.Effect<void> {
    return Effect.gen(function* () {
      if (!state.result || !state.callID || state.result.output === "No answer found for question") return

      log.info("knowledge inject start success")

      yield* sessions.updatePart({
        id: PartID.ascending(),
        sessionID,
        messageID,
        type: "tool",
        tool: KNOWLEDGE_TOOL_ID,
        callID: state.callID,
        state: {
          status: "completed",
          input: { question: state.userInput },
          output: state.result.output,
          title: state.result.title,
          metadata: state.result.metadata,
          time: {
            start: Date.now(),
            end: Date.now(),
          },
        },
      })

      // 重置状态
      state.result = null
      state.callID = null
      state.pending = false
    })
  }

  export function reset(): void {
    state.result = null
    state.callID = null
    state.userInput = ""
    state.pending = false
  }
}
