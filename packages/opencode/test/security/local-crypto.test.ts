import { describe, expect, test } from "bun:test"
import fs from "fs"
import path from "path"
import { Global } from "@opencode-ai/core/global"
import {
  decryptAuthData,
  decryptForLocalStorage,
  encryptAuthData,
  encryptForLocalStorage,
  isEncryptedBlob,
} from "../../src/security/local-crypto"

// local-crypto persists key material under Global.Path.config. The test preload
// (test/preload.ts) redirects XDG_CONFIG_HOME into an isolated tmpdir, so
// Global.Path.config already points away from the user's real config — no manual
// fs isolation is needed here.

describe("local-crypto", () => {
  describe("isEncryptedBlob", () => {
    test("accepts a well-formed blob", () => {
      const blob = { version: 1, algorithm: "aes-256-gcm", ciphertext: "x", iv: "y", authTag: "z", timeStamp: 1 }
      expect(isEncryptedBlob(blob)).toBe(true)
    })

    test("rejects non-object values", () => {
      expect(isEncryptedBlob(null)).toBe(false)
      expect(isEncryptedBlob(undefined)).toBe(false)
      expect(isEncryptedBlob("string")).toBe(false)
      expect(isEncryptedBlob(42)).toBe(false)
    })

    test("rejects a blob with the wrong algorithm", () => {
      expect(isEncryptedBlob({ algorithm: "aes-128-gcm", ciphertext: "x", iv: "y", authTag: "z" })).toBe(false)
    })

    test("rejects a blob missing required fields", () => {
      expect(isEncryptedBlob({ algorithm: "aes-256-gcm" })).toBe(false)
      expect(isEncryptedBlob({ algorithm: "aes-256-gcm", ciphertext: "x", iv: "y" })).toBe(false)
      // all crypto fields present but missing the version/timeStamp metadata
      expect(isEncryptedBlob({ algorithm: "aes-256-gcm", ciphertext: "x", iv: "y", authTag: "z" })).toBe(false)
    })
  })

  describe("encryptForLocalStorage / decryptForLocalStorage", () => {
    test("round-trips plaintext back to the original value", () => {
      const blob = encryptForLocalStorage("secret token value")
      expect(decryptForLocalStorage(blob)).toBe("secret token value")
    })

    test("produces a base64 ciphertext that differs from the plaintext", () => {
      const blob = encryptForLocalStorage("hello world")
      expect(blob.algorithm).toBe("aes-256-gcm")
      expect(blob.ciphertext).not.toBe("hello world")
      expect(blob.ciphertext).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
    })

    test("uses a random IV so identical plaintexts yield different ciphertexts", () => {
      const a = encryptForLocalStorage("same value")
      const b = encryptForLocalStorage("same value")
      expect(a.ciphertext).not.toBe(b.ciphertext)
      expect(a.iv).not.toBe(b.iv)
    })

    test("persists key material under the config dir", () => {
      encryptForLocalStorage("materialise keys")
      expect(fs.existsSync(path.join(Global.Path.config, "keys"))).toBe(true)
      expect(fs.existsSync(path.join(Global.Path.config, "token.dek"))).toBe(true)
    })

    test("fails when the ciphertext has been tampered with (GCM auth)", () => {
      const blob = encryptForLocalStorage("data")
      const tampered = { ...blob, ciphertext: Buffer.from("tampered").toString("base64") }
      expect(() => decryptForLocalStorage(tampered)).toThrow()
    })
  })

  describe("encryptAuthData / decryptAuthData", () => {
    test("encrypts sensitive fields and round-trips them, leaving others untouched", () => {
      const data = {
        provider: { access: "access-token", refresh: "refresh-token", username: "alice" },
      }
      const encrypted = encryptAuthData(data)
      const enc = encrypted.provider as Record<string, unknown>
      expect(isEncryptedBlob(enc.access)).toBe(true)
      expect(isEncryptedBlob(enc.refresh)).toBe(true)
      expect(enc.username).toBe("alice")

      const decrypted = decryptAuthData(encrypted)
      const dec = decrypted.provider as Record<string, unknown>
      expect(dec.access).toBe("access-token")
      expect(dec.refresh).toBe("refresh-token")
      expect(dec.username).toBe("alice")
    })

    test("passes non-object provider entries through unchanged", () => {
      const data = { skip: "not-an-object" }
      expect(encryptAuthData(data)).toEqual(data)
    })
  })
})
