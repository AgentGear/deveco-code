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
import { callHarmonyNapiTool, resolveUIVerifyParams } from '../tool/lib/harmony_napi'
import { getSessionCwd } from '../tool/lib/session-cwd';
import emulatorTools from '../tool/lib/emulator_tools.json' with { type: "json" }
import { Schema, Exit, Cause } from "effect"
import path from 'node:path'
import fs from 'node:fs'


type ListedTool = {
  name?: unknown;
  description?: unknown;
  inputSchema?: unknown;
  input_schema?: unknown;
};

/**
 * Converts a JSON Schema property to an Effect.Schema.
 * Supports basic types: string, boolean, number, integer, array, object.
 */
function jsonSchemaPropertyToEffectSchema(prop: Record<string, unknown>): Schema.Decoder<unknown> {
  const type = prop.type as string | undefined
  const nullable = prop.nullable as boolean | undefined

  switch (type) {
    case 'string':
      return Schema.String as Schema.Decoder<unknown>

    case 'boolean':
      return Schema.Boolean as Schema.Decoder<unknown>

    case 'number':
    case 'integer':
      return Schema.Number as Schema.Decoder<unknown>

    case 'array': {
      const items = prop.items as Record<string, unknown> | undefined
      if (items && typeof items === 'object') {
        const itemSchema = jsonSchemaPropertyToEffectSchema(items)
        return Schema.Array(itemSchema) as Schema.Decoder<unknown>
      }
      return Schema.Array(Schema.Unknown) as Schema.Decoder<unknown>
    }

    case 'object': {
      const properties = prop.properties as Record<string, Record<string, unknown>> | undefined
      if (properties && typeof properties === 'object') {
        const schemaObj: Record<string, Schema.Decoder<unknown>> = {}
        for (const [key, value] of Object.entries(properties)) {
          schemaObj[key] = jsonSchemaPropertyToEffectSchema(value)
        }
        return Schema.Struct(schemaObj) as Schema.Decoder<unknown>
      }
      return Schema.Unknown as Schema.Decoder<unknown>
    }

    default:
      return Schema.Unknown as Schema.Decoder<unknown>
  }
}

/**
 * Converts a JSON Schema to an Effect.Schema for validation.
 * Handles the top-level object schema with properties and required fields.
 */
function jsonSchemaToEffectSchema(inputSchema: unknown): Schema.Decoder<unknown> | null {
  if (!inputSchema || typeof inputSchema !== 'object' || Array.isArray(inputSchema)) {
    return null
  }

  const schema = inputSchema as Record<string, unknown>
  const type = schema.type as string | undefined

  // Only handle object type at the top level
  if (type !== 'object') {
    return null
  }

  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined
  if (!properties || typeof properties !== 'object') {
    return null
  }

  const required = schema.required as string[] | undefined

  // Build property schemas
  const schemaObj: Record<string, Schema.Decoder<unknown>> = {}
  for (const [key, prop] of Object.entries(properties)) {
    if (typeof prop !== 'object' || Array.isArray(prop)) {
      schemaObj[key] = Schema.Unknown as Schema.Decoder<unknown>
      continue
    }

    const propSchema = jsonSchemaPropertyToEffectSchema(prop as Record<string, unknown>)
    const isRequired = required ? required.includes(key) : false
    const isNullable = (prop as Record<string, unknown>).nullable as boolean | undefined

    // Handle optional/nullable fields
    if (!isRequired || isNullable) {
      schemaObj[key] = Schema.optional(propSchema) as Schema.Decoder<unknown>
    } else {
      schemaObj[key] = propSchema
    }
  }

  return Schema.Struct(schemaObj) as Schema.Decoder<unknown>
}

/**
 * Formats an Effect.Schema parse error into a human-readable string.
 */
function formatSchemaError(error: unknown): string {
  if (error && typeof error === 'object') {
    const err = error as { message?: string; _tag?: string }
    if (err.message) return err.message
    if (err._tag) return `Validation error: ${err._tag}`
  }
  return 'Schema validation failed'
}

function parseArgsJson(input?: string, inputSchema?: unknown): Record<string, unknown> {
  const raw = (input ?? '').trim();
  if (!raw) return {};
  const value = JSON.parse(raw) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('argsJson must be a JSON object string');
  }

  // Validate against inputSchema if provided
  if (inputSchema && typeof inputSchema === 'object') {
    const effectSchema = jsonSchemaToEffectSchema(inputSchema)

    if (effectSchema) {
      // Use Effect.Schema to validate
      const decoded = Schema.decodeUnknownExit(effectSchema)(value, { errors: "all" })

      if (Exit.isFailure(decoded)) {
        const error = Cause.squash(decoded.cause)
        throw new Error(`Args validation failed: ${formatSchemaError(error)}`)
      }
    }
  }

  return value as Record<string, unknown>;
}

function parseToolArgs(args: unknown, inputSchema?: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return parseArgsJson(undefined, inputSchema);

  const record = args as Record<string, unknown>;
  if (typeof record.argsJson === 'string' && Object.keys(record).length === 1) {
    return parseArgsJson(record.argsJson, inputSchema);
  }

  if (inputSchema && typeof inputSchema === 'object') {
    const effectSchema = jsonSchemaToEffectSchema(inputSchema);

    if (effectSchema) {
      const decoded = Schema.decodeUnknownExit(effectSchema)(record, { errors: "all" });

      if (Exit.isFailure(decoded)) {
        const error = Cause.squash(decoded.cause);
        throw new Error(`Args validation failed: ${formatSchemaError(error)}`);
      }
    }
  }

  return { ...record };
}

/**
 * Sanitizes and validates a file path to prevent path traversal attacks.
 * Ensures the resolved path is within the allowed worktree directory.
 * @param filePath - The file path to validate (can be relative or absolute)
 * @param worktree - The allowed base directory
 * @returns The validated absolute path
 * @throws Error if path traversal is detected
 */
function sanitizeFilePath(filePath: string, worktree: string): string {
  // Resolve the path relative to worktree
  const resolved = path.resolve(worktree, filePath);

  // Get real paths to handle symlinks and normalize
  let realResolved: string;
  let realWorktree: string;

  try {
    realResolved = fs.realpathSync(resolved);
  } catch {
    // Path doesn't exist yet - use resolved path for comparison
    realResolved = resolved;
  }

  try {
    realWorktree = fs.realpathSync(worktree);
  } catch {
    realWorktree = worktree;
  }

  // Normalize paths for comparison (ensure consistent separators)
  const normalizedResolved = path.normalize(realResolved);
  const normalizedWorktree = path.normalize(realWorktree);

  // Check if resolved path starts with worktree path
  // Use path.sep to ensure we're comparing directory boundaries correctly
  const worktreePrefix = normalizedWorktree.endsWith(path.sep)
    ? normalizedWorktree
    : normalizedWorktree + path.sep;

  if (normalizedResolved !== normalizedWorktree && !normalizedResolved.startsWith(worktreePrefix)) {
    throw new Error(`Path traversal detected: ${filePath} resolves to ${resolved}, which is outside worktree ${worktree}`);
  }

  return realResolved;
}

/**
 * Validates file path parameters in tool arguments.
 * Checks for known path parameter names and validates them against the worktree.
 */
function validatePathParameters(args: Record<string, unknown>, worktree: string): void {
  // Known path parameter names that need validation
  const pathParams = ['log_path', 'dirname', 'filePath', 'filepath', 'path'];

  for (const paramName of pathParams) {
    if (paramName in args && typeof args[paramName] === 'string') {
      const filePath = args[paramName] as string;
      // Validate and normalize the path
      args[paramName] = sanitizeFilePath(filePath, worktree);
    }
  }
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


function buildProxiedToolDescription(name: string, description: string | undefined): string {
  return description?.trim() ?? `HarmonyOS N-API tool: ${name}.`;
}

function buildToolJsonSchema(inputSchema: unknown): Record<string, unknown> | undefined {
  if (!inputSchema || typeof inputSchema !== 'object' || Array.isArray(inputSchema)) return undefined;
  const schema = inputSchema as Record<string, unknown>;
  return {
    ...schema,
    type: "object",
    properties:
      schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
        ? schema.properties
        : {},
  };
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


const HarmonyNapiDynamicToolsPlugin: Plugin = async (_input) => {
  const listed = normalizeToolList(emulatorTools);
  const tools = Object.fromEntries(
    listed.map(({ name, description, inputSchema }) => {
      const t = tool({
        description: buildProxiedToolDescription(name, description),
        args: {},
        jsonSchema: buildToolJsonSchema(inputSchema),
        async execute(args, ctx) {
          if (!process.env.DEVECO_HOME?.trim()) throw new Error('DEVECO_HOME environment variable is not configured. PLEASE set your DEVECO_HOME path manually and restart.');
          const worktree = resolveWorktree(ctx as { sessionID?: string; directory?: string; worktree?: string });
          if (name === 'verify_ui') {
            const params = await resolveUIVerifyParams(worktree);
            if (!params.baseURL || !params.apiKey || !params.modelName) {
              return "工具调用失败。请将以下内容原文告知用户，不要修改或补充，告知后立即停止，不要再调用任何工具：「UI 意图校验功能不可用：未配置多模态模型。请在配置文件中为 ui_verification agent 配置一个支持多模态的模型，或登录账号以使用内置多模态模型。」"
            }
          }
          // Validate direct tool arguments against the original schema. A legacy
          // argsJson wrapper is still accepted for older callers.
          const payload = parseToolArgs(args, inputSchema);

          // Validate file path parameters to prevent path traversal attacks
          validatePathParameters(payload, worktree);

          if (name === 'verify_ui') {
            const typedCtx = ctx as { sessionID?: string };
            if (typedCtx.sessionID) {
              payload.sessionId = typedCtx.sessionID;
            }
          }

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
