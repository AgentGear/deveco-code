/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { Effect } from "effect"
import { PluginV2 } from "../plugin"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeDevecoContent from "./skill/customize-deveco.md" with { type: "text" }

export const CustomizeDevecoContent = customizeDevecoContent

export const Plugin = PluginV2.define({
  id: PluginV2.ID.make("skill"),
  effect: Effect.gen(function* () {
    const skill = yield* SkillV2.Service
    const transform = yield* skill.transform()

    yield* transform((editor) => {
      editor.source(
        new SkillV2.EmbeddedSource({
          type: "embedded",
          skill: new SkillV2.Info({
            name: "customize-deveco",
            description:
              "Use ONLY when the user is editing or creating DevEco Code's own configuration: deveco.json, deveco.jsonc, files under .deveco/, or files under ~/.config/deveco/. Also use when creating or fixing DevEco Code agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring DevEco Code itself.",
            location: AbsolutePath.make("/builtin/customize-deveco.md"),
            content: CustomizeDevecoContent,
          }),
        }),
      )
    })
  }),
})
