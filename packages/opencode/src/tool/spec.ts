import path from "path"
import fs from "fs/promises"
import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { InstanceState } from "@/effect/instance-state"
import WRITE_DESCRIPTION from "./spec-write.txt"
import { validateDocumentSimple } from "./document-validation/document-validate-tool"

async function exists(p: string) {
  return fs.access(p).then(
    () => true,
    () => false,
  )
}

async function resolveFeatureDir(cwd: string): Promise<string> {
  const featureJsonPath = path.join(cwd, ".specs", "feature.json")
  if (await exists(featureJsonPath)) {
    try {
      const raw = await fs.readFile(featureJsonPath, "utf-8")
      const data = JSON.parse(raw)
      const dir = data.feature_directory ?? data.default_feature_dir ?? ""
      if (dir) {
        return path.resolve(cwd, dir)
      }
    } catch {
      // ignore parse errors
    }
  }
  return path.join(cwd, ".specs", "default")
}

const DOC_TYPE_MAP: Record<string, "spec" | "design" | "tasks"> = {
  "spec.md": "spec",
  "plan.md": "design",
  "tasks.md": "tasks",
}

const WriteParameters = Schema.Struct({
  file: Schema.Literals(["spec.md", "plan.md", "tasks.md"]).annotate({ description: "The artifact file to write." }),
  content: Schema.String.annotate({ description: "The content to write." }),
  directory: Schema.optional(Schema.String).annotate({
    description:
      "Optional target directory override. When not provided, the tool reads .specs/feature.json for the current feature path.",
  }),
  append: Schema.optional(Schema.Boolean).annotate({
    description: "If true, append to the existing file instead of overwriting.",
  }),
})

export const SpecWriteTool = Tool.define(
  "spec_write",
  Effect.gen(function* () {
    return {
      description: WRITE_DESCRIPTION,
      parameters: WriteParameters,
      execute: (params: Schema.Schema.Type<typeof WriteParameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const cwd = params.directory
            ? path.resolve(instance.directory, params.directory)
            : yield* Effect.promise(() => resolveFeatureDir(instance.directory))

          yield* Effect.tryPromise(() => fs.mkdir(cwd, { recursive: true }))
          const target = path.join(cwd, params.file)
          if (params.append) {
            yield* Effect.tryPromise(() => fs.appendFile(target, params.content, "utf-8"))
          } else {
            yield* Effect.tryPromise(() => fs.writeFile(target, params.content, "utf-8"))
          }

          const display = path.relative(instance.directory, target)
          const docType = DOC_TYPE_MAP[params.file]
          const validationResult = docType ? validateDocumentSimple(target, docType) : ""

          return {
            title: "Spec Artifact Written",
            output: `Written to ${display}${validationResult}`,
            metadata: { path: target },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
