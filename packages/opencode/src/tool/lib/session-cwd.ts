/*
 * Copyright (c) 2026 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const sessionCwd = new Map<string, string>();

export function setSessionCwd(sessionID: string, cwd: string) {
  const id = sessionID.trim();
  const dir = cwd.trim();
  if (!id || !dir) {
    return;
  }
  sessionCwd.set(id, dir);
}

export function getSessionCwd(sessionID: string | undefined) {
  if (!sessionID) {
    return undefined;
  }
  return sessionCwd.get(sessionID);
}

export function clearSessionCwd(sessionID?: string) {
  if (!sessionID) {
    sessionCwd.clear();
    return;
  }
  sessionCwd.delete(sessionID);
}
