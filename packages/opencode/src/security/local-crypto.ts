import fs from "fs"
import path from "path"
import crypto from "crypto"
import { Global } from "@opencode-ai/core/global"

interface WrappedDekData {
  version: number
  algorithm: "aes-256-gcm"
  kekId: string
  encryptedDek: string
  iv: string
  authTag: string
  timeStamp: number
}

export interface EncryptedBlob {
  version: number
  algorithm: "aes-256-gcm"
  ciphertext: string
  iv: string
  authTag: string
  timeStamp: number
}

const SENSITIVE_AUTH_KEYS = new Set(["access", "refresh", "key", "token"])

const algorithm: "aes-256-gcm" = "aes-256-gcm"
const ivLength = 12
const kekLength = 32
const dekLength = 32
const rootKeyIds = ["kek-v1", "kek-v2", "kek-v3"] as const

const configPath = Global.Path.config
const keyDirPath = path.join(configPath, "keys")
const wrappedDekPath = path.join(configPath, "token.dek")

function getRootKeyPath(keyId: string): string {
  return path.join(keyDirPath, `${keyId}.bin`)
}

function ensureDirectories() {
  if (!fs.existsSync(configPath)) fs.mkdirSync(configPath, { recursive: true, mode: 0o700 })
  if (!fs.existsSync(keyDirPath)) fs.mkdirSync(keyDirPath, { recursive: true, mode: 0o700 })
}

function ensureRootKeys() {
  ensureDirectories()
  for (const keyId of rootKeyIds) {
    const filePath = getRootKeyPath(keyId)
    if (fs.existsSync(filePath)) continue
    fs.writeFileSync(filePath, crypto.randomBytes(kekLength), { mode: 0o600 })
  }
}

function loadRootKey(keyId: string): Buffer {
  ensureRootKeys()
  const filePath = getRootKeyPath(keyId)
  const key = fs.readFileSync(filePath)
  if (key.length === kekLength) return key
  const next = crypto.randomBytes(kekLength)
  fs.writeFileSync(filePath, next, { mode: 0o600 })
  return next
}

function wrapDekWithKek(dek: Buffer, kekId: string): WrappedDekData {
  const iv = crypto.randomBytes(ivLength)
  const kek = loadRootKey(kekId)
  const cipher = crypto.createCipheriv(algorithm, kek, iv) as crypto.CipherGCM
  const encryptedDek = Buffer.concat([cipher.update(dek), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    version: 1,
    algorithm,
    kekId,
    encryptedDek: encryptedDek.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    timeStamp: Date.now(),
  }
}

function unwrapDek(wrapped: WrappedDekData): Buffer {
  const kek = loadRootKey(wrapped.kekId)
  const iv = Buffer.from(wrapped.iv, "base64")
  const authTag = Buffer.from(wrapped.authTag, "base64")
  const encryptedDek = Buffer.from(wrapped.encryptedDek, "base64")
  const decipher = crypto.createDecipheriv(algorithm, kek, iv) as crypto.DecipherGCM
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encryptedDek), decipher.final()])
}

function ensureWrappedDek() {
  ensureRootKeys()
  if (fs.existsSync(wrappedDekPath)) return
  const dek = crypto.randomBytes(dekLength)
  const wrapped = wrapDekWithKek(dek, rootKeyIds[0])
  fs.writeFileSync(wrappedDekPath, JSON.stringify(wrapped, null, 2), { mode: 0o600 })
}

function loadDek(): Buffer {
  ensureWrappedDek()
  const wrapped = JSON.parse(fs.readFileSync(wrappedDekPath, "utf8")) as WrappedDekData
  const dek = unwrapDek(wrapped)
  if (dek.length === dekLength) return dek
  const next = crypto.randomBytes(dekLength)
  const nextWrapped = wrapDekWithKek(next, rootKeyIds[0])
  fs.writeFileSync(wrappedDekPath, JSON.stringify(nextWrapped, null, 2), { mode: 0o600 })
  return next
}

export function encryptForLocalStorage(plaintext: string): EncryptedBlob {
  const dek = loadDek()
  const iv = crypto.randomBytes(ivLength)
  const cipher = crypto.createCipheriv(algorithm, dek, iv) as crypto.CipherGCM
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    version: 1,
    algorithm,
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    timeStamp: Date.now(),
  }
}

export function decryptForLocalStorage(blob: EncryptedBlob): string {
  try {
    const dek = loadDek()
    const iv = Buffer.from(blob.iv, "base64")
    const authTag = Buffer.from(blob.authTag, "base64")
    const ciphertext = Buffer.from(blob.ciphertext, "base64")
    const decipher = crypto.createDecipheriv(algorithm, dek, iv) as crypto.DecipherGCM
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
  } catch (cause) {
    throw new Error("Failed to decrypt local ciphertext", { cause })
  }
}

export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<EncryptedBlob>
  return (
    candidate.algorithm === "aes-256-gcm" &&
    typeof candidate.ciphertext === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.authTag === "string"
  )
}

function encryptAuthRecord(info: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(info).map(([field, value]) => {
      if (typeof value !== "string") return [field, value]
      if (!SENSITIVE_AUTH_KEYS.has(field)) return [field, value]
      return [field, encryptForLocalStorage(value)]
    }),
  )
}

function decryptAuthRecord(provider: string, info: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(info).map(([field, value]) => {
      if (!SENSITIVE_AUTH_KEYS.has(field)) return [field, value]
      if (!isEncryptedBlob(value)) return [field, value]
      try {
        return [field, decryptForLocalStorage(value)]
      } catch (cause) {
        throw new Error(`Failed to decrypt auth field "${field}" for provider "${provider}"`, {
          cause,
        })
      }
    }),
  )
}

export function encryptAuthData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([provider, info]) => {
      if (!info || typeof info !== "object") return [provider, info]
      return [provider, encryptAuthRecord(info as Record<string, unknown>)]
    }),
  )
}

export function decryptAuthData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([provider, info]) => {
      if (!info || typeof info !== "object") return [provider, info]
      return [provider, decryptAuthRecord(provider, info as Record<string, unknown>)]
    }),
  )
}

export * as LocalCrypto from "./local-crypto"
