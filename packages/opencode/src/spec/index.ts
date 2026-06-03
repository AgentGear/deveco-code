import path from "path"
import { Effect, Layer, Context, Schema } from "effect"
import { withStatics } from "@opencode-ai/core/schema"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import * as Log from "@opencode-ai/core/util/log"
import { Defaults } from "./defaults"

const log = Log.create({ service: "spec" })

export const Info = Schema.Struct({
  commandsPath: Schema.String,
  templatesPath: Schema.String,
}).pipe(withStatics((s) => ({})))
export type Info = Schema.Schema.Type<typeof Info>

export interface Interface {
  readonly get: () => Effect.Effect<Info>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Spec") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fsys = yield* AppFileSystem.Service

    const { specDir } = yield* Defaults.ensure(InstallationVersion, fsys).pipe(Effect.orDie)

    log.info("spec resources initialized", {
      commands: path.join(specDir, "commands"),
      templates: path.join(specDir, "templates"),
    })

    const get = Effect.fn("Spec.get")(function* () {
      return {
        commandsPath: path.join(specDir, "commands"),
        templatesPath: path.join(specDir, "templates"),
      }
    })

    return Service.of({ get })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(AppFileSystem.defaultLayer))

export * as Spec from "."
