import path from "path"
import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { InstanceState } from "@/effect/instance-state"
import WRITE_DESCRIPTION from "./spec-write.txt"
import { validateDocumentSimple } from "./document-validation/document-validate-tool"
import { WriteTool } from "./write"

const DOC_TYPE_MAP: Record<string, "spec" | "design" | "tasks"> = {
  "spec.md": "spec",
  "plan.md": "design",
  "tasks.md": "tasks",
}

const WriteParameters = Schema.Struct({
  filePath: Schema.String.annotate({
    description: "The absolute path to the file to write (must be absolute, not relative)",
  }),
  content: Schema.String.annotate({ description: "The content to write." }),
})

export const SpecWriteTool = Tool.define(
  "spec_write",
  Effect.gen(function* () {
    const writeInfo = yield* WriteTool
    const writeDef = yield* Tool.init(writeInfo)

    return {
      description: WRITE_DESCRIPTION,
      parameters: WriteParameters,
      execute: (params: Schema.Schema.Type<typeof WriteParameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const filepath = path.isAbsolute(params.filePath)
            ? params.filePath
            : path.join(instance.directory, params.filePath)

          const writeResult = yield* writeDef.execute({ filePath: filepath, content: params.content }, ctx)

          const basename = path.basename(filepath)
          const docType = DOC_TYPE_MAP[basename]
          const validationResult = docType ? validateDocumentSimple(filepath, docType) : ""

          return {
            title: "Spec Artifact Written",
            output: `${writeResult.output}${validationResult}`,
            metadata: writeResult.metadata,
            ...(writeResult.attachments ? { attachments: writeResult.attachments } : {}),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
