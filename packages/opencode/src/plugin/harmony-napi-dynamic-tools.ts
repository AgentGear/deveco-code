/*
 * Copyright (c) 2026 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Plugin } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'
import { callHarmonyNapiTool } from '../tool/lib/harmony_napi'
import { getSessionCwd } from '../tool/lib/session-cwd';
import emulatorTools from '../tool/lib/emulator_tools.json' with { type: "json" }


type ListedTool = {
  name?: unknown;
  description?: unknown;
  inputSchema?: unknown;
  input_schema?: unknown;
};

function parseArgsJson(input?: string): Record<string, unknown> {
  const raw = (input ?? '').trim();
  if (!raw) return {};
  const value = JSON.parse(raw) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('argsJson must be a JSON object string');
  }
  return value as Record<string, unknown>;
}

function textFromCallResult(result: unknown): string {
  if (!result || typeof result !== 'object') return JSON.stringify(result, null, 2);
  const maybe = result as { content?: unknown };
  const content = maybe.content;
  if (!Array.isArray(content)) return JSON.stringify(result, null, 2);
  const text = content
    .map((c) => (c && typeof c === 'object' && typeof (c as { text?: unknown }).text === 'string' ? (c as { text: string }).text : ''))
    .filter(Boolean)
    .join('\n');
  return text || JSON.stringify(result, null, 2);
}

function normalizeToolList(
  value: unknown,
): Array<{ name: string; description?: string; inputSchema?: unknown }> {
  if (Array.isArray(value)) {
    return value
      .map((item) => item as ListedTool)
      .map((item) => ({
        name: typeof item.name === 'string' ? item.name : '',
        description: typeof item.description === 'string' ? item.description : undefined,
        inputSchema: item.inputSchema ?? item.input_schema,
      }))
      .filter((t) => Boolean(t.name));
  }

  if (value && typeof value === 'object') {
    const maybe = value as { tools?: unknown };
    if (Array.isArray(maybe.tools)) return normalizeToolList(maybe.tools);

    // Support map form: { toolName: { description } } or { toolName: "desc" }
    return Object.entries(value as Record<string, unknown>)
      .map(([name, meta]) => {
        if (typeof meta === 'string') return { name, description: meta, inputSchema: undefined };
        if (meta && typeof meta === 'object') {
          const m = meta as ListedTool;
          const d = m.description;
          return {
            name,
            description: typeof d === 'string' ? d : undefined,
            inputSchema: m.inputSchema,
          };
        }
        return { name, description: undefined, inputSchema: undefined };
      })
      .filter((t) => Boolean(t.name));
  }

  return [];
}


function buildArgsJsonExample(inputSchema: unknown): string | null {
  if (!inputSchema || typeof inputSchema !== 'object' || Array.isArray(inputSchema)) return null;
  const schema = inputSchema as { properties?: Record<string, { type?: string; items?: unknown; description?: string }> };
  if (!schema.properties) return null;
  const example: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.type === 'array') {
      example[key] = [`<${key}_item>`];
    } else if (prop.type === 'boolean') {
      example[key] = false;
    } else if (prop.type === 'number' || prop.type === 'integer') {
      example[key] = 0;
    } else {
      example[key] = `<${key}>`;
    }
  }
  return JSON.stringify(example);
}

function buildProxiedToolDescription(name: string, description: string | undefined, inputSchema: unknown): string {
  const head =
    description?.trim()
    ?? `HarmonyOS N-API tool: ${name}. Provide the tool arguments as argsJson: a single JSON string whose parsed value is an object matching the input schema below.`;

  if (inputSchema === undefined || inputSchema === null) return head;

  const schemaText =
    typeof inputSchema === 'string'
      ? inputSchema
      : JSON.stringify(inputSchema, null, 2);
  if (!schemaText || schemaText === '{}' || schemaText.trim() === '') return head;

  const example = buildArgsJsonExample(inputSchema);
  const exampleLine = example ? `\nExample: argsJson='${example}'` : '';

  return `${head}\n\nInput schema (object you must stringify into argsJson):\n\`\`\`json\n${schemaText}\n\`\`\`${exampleLine}`;
}


function resolveWorktree(ctx: { sessionID?: string; directory?: string; worktree?: string }): string {
  const sessionDir = getSessionCwd(ctx.sessionID);
  if (sessionDir) {
    return sessionDir;
  }
  const directory = typeof ctx.directory === 'string' ? ctx.directory.trim() : '';
  if (directory) {
    return directory;
  }
  const worktree = typeof ctx.worktree === 'string' ? ctx.worktree.trim() : '';
  if (worktree) {
    return worktree;
  }
  return process.cwd();
}

const gated = new Set(['verify_ui', 'save_ui_screenshot', 'get_ui_verification_log']);

const HarmonyNapiDynamicToolsPlugin: Plugin = async (_input) => {
  const uiTest = process.env.ADDITIONAL_TOOL_GROUPS === 'ui_integration_test';
  const listed = normalizeToolList(emulatorTools).filter((t) => uiTest || !gated.has(t.name));
  const tools = Object.fromEntries(
    listed.map(({ name, description, inputSchema }) => {
      const t = tool({
        description: buildProxiedToolDescription(name, description, inputSchema),
        args: {
          argsJson: tool.schema
            .string()
            .optional()
            .describe(
              'JSON string of one object: the tool arguments, matching the Input schema block in the tool description.',
            ),
        },
        async execute(args, ctx) {
          const payload = parseArgsJson((args as { argsJson?: string }).argsJson);
          const worktree = resolveWorktree(ctx as { sessionID?: string; directory?: string; worktree?: string });
          const result = await callHarmonyNapiTool({ worktree, toolName: name, args: payload });
          return textFromCallResult(result);
        },
      });
      return [name, t] as const;
    }),
  );

  return {
    tool: tools,
  };
};

export default HarmonyNapiDynamicToolsPlugin;
