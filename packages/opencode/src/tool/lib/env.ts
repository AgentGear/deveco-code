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

import fs from "fs/promises";
import path from "path";

function binary(name: string) {
  return process.platform === "win32" ? `${name}.exe` : name;
}

function envPath() {
  return String(process.env.DEVECO_HOME || "").trim();
}

async function isDir(file: string) {
  if (!file) {
    return false;
  }
  return fs
    .stat(file)
    .then((info) => info.isDirectory())
    .catch(() => false);
}

function defaults() {
  if (process.platform === "darwin") {
    return [
      "/Applications/DevEco-Studio.app/Contents",
    ];
  }
  if (process.platform === "linux") {
    const home = String(process.env.HOME || "").trim();
    return [
      home ? path.join(home, "devecostudio/Contents") : "",
      home ? path.join(home, "DevEco-Studio/Contents") : "",
    ].filter(Boolean);
  }
  const home = String(process.env.USERPROFILE || "").trim();
  return [
    "C:\\Program Files\\DevEco Studio",
    "C:\\Program Files (x86)\\DevEco Studio",
    home ? path.join(home, "DevEco Studio") : "",
  ].filter(Boolean);
}

export function nodePath(home: string) {
  return process.platform === "win32"
    ? path.join(home, "tools", "node", "node.exe")
    : path.join(home, "tools", "node", "bin", "node");
}

export function hvigorPath(home: string) {
  return path.join(home, "tools", "hvigor", "bin", "hvigorw.js");
}

export function sdkPath(home: string) {
  return path.join(home, "sdk");
}

export function hdcPath(home: string) {
  return path.join(home, "sdk", "default", "openharmony", "toolchains", binary("hdc"));
}

export async function findDevEcoHome(): Promise<string | undefined> {
  const env = envPath();
  if (env && (await isDir(env)) && (await Bun.file(nodePath(env)).exists())) {
    return env;
  }

  for (const item of defaults()) {
    if (!(await isDir(item))) {
      continue;
    }
    if (await Bun.file(nodePath(item)).exists()) {
      return item;
    }
  }
  return undefined;
}

export function buildEnv(home: string, sdk: string) {
  const sep = process.platform === "win32" ? ";" : ":";
  const raw = process.env.PATH || process.env.Path || process.env.path || "";
  const sys = process.platform === "win32" ? process.env.SystemRoot || process.env.SYSTEMROOT || "C:\\Windows" : "";
  const base = process.platform === "win32" ? path.join(sys, "System32") : "";
  const current = [
    base,
    sys,
    process.platform === "win32" ? path.join(base, "Wbem") : "",
    process.platform === "win32" ? path.join(base, "WindowsPowerShell", "v1.0") : "",
    raw,
  ]
    .filter(Boolean)
    .join(sep);
  const extra = [
    path.join(home, "tools", "node", "bin"),
    path.join(home, "tools", "ohpm", "bin"),
    path.join(home, "tools", "hvigor", "bin"),
  ];
  const merged = [...extra, current].filter(Boolean).join(sep);
  const cmd = process.platform === "win32" ? process.env.ComSpec || process.env.COMSPEC || path.join(base, "cmd.exe") : "";
  return {
    DEVECO_HOME: home,
    DEVECO_SDK_HOME: sdk,
    ...(process.platform === "win32"
      ? {
          SystemRoot: sys,
          SYSTEMROOT: sys,
          ComSpec: cmd,
          COMSPEC: cmd,
          Path: merged,
        }
      : {}),
    PATH: merged,
  };
}
