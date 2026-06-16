import { describe, expect, test } from "bun:test"
import {
  AGREEMENT_DEFAULTS,
  KV_DEVECO_CODE_PRIVACY_ACCEPTED,
  resolveAgreementConfig,
  type AgreementConfig,
} from "../../src/cli/deveco-legal"

describe("deveco-legal", () => {
  describe("AGREEMENT_DEFAULTS", () => {
    test("exposes all five config keys with non-empty values", () => {
      expect(AGREEMENT_DEFAULTS.tms_url).toBeTruthy()
      expect(AGREEMENT_DEFAULTS.privacy_url).toBeTruthy()
      expect(AGREEMENT_DEFAULTS.terms_url).toBeTruthy()
      expect(AGREEMENT_DEFAULTS.privacy_id).toBeTruthy()
      expect(AGREEMENT_DEFAULTS.terms_id).toBeTruthy()
    })

    test("points at Huawei legal and TMS endpoints", () => {
      expect(AGREEMENT_DEFAULTS.tms_url).toMatch(/huawei|dbankcloud/i)
      expect(AGREEMENT_DEFAULTS.privacy_url).toMatch(/huawei|legal/i)
      expect(AGREEMENT_DEFAULTS.terms_url).toMatch(/huawei|legal/i)
    })
  })

  describe("resolveAgreementConfig", () => {
    test("returns the built-in defaults when called with no overrides", () => {
      expect(resolveAgreementConfig()).toEqual(AGREEMENT_DEFAULTS)
    })

    test("returns the built-in defaults when called with an empty object", () => {
      expect(resolveAgreementConfig({})).toEqual(AGREEMENT_DEFAULTS)
    })

    test("falls back to defaults for every field not present in overrides", () => {
      const config = resolveAgreementConfig({ tms_url: "https://example.test/tms" })
      expect(config.tms_url).toBe("https://example.test/tms")
      expect(config.privacy_url).toBe(AGREEMENT_DEFAULTS.privacy_url)
      expect(config.terms_url).toBe(AGREEMENT_DEFAULTS.terms_url)
      expect(config.privacy_id).toBe(AGREEMENT_DEFAULTS.privacy_id)
      expect(config.terms_id).toBe(AGREEMENT_DEFAULTS.terms_id)
    })

    test("honours a full override for every field", () => {
      const overrides = {
        tms_url: "https://t.test/u",
        privacy_url: "https://p.test",
        terms_url: "https://t.test",
        privacy_id: "90000000",
        terms_id: "80000000",
      }
      expect(resolveAgreementConfig(overrides)).toEqual(overrides)
    })

    test("lets each field be overridden independently while the rest stay default", () => {
      const keys = Object.keys(AGREEMENT_DEFAULTS) as Array<keyof typeof AGREEMENT_DEFAULTS>
      for (const key of keys) {
        const value = `custom-${key}`
        const result = resolveAgreementConfig({ [key]: value } as AgreementConfig)
        expect(result[key]).toBe(value)
        for (const other of keys.filter((k) => k !== key)) {
          expect(result[other]).toBe(AGREEMENT_DEFAULTS[other])
        }
      }
    })
  })

  test("KV_DEVECO_CODE_PRIVACY_ACCEPTED is a stable local cache key", () => {
    expect(KV_DEVECO_CODE_PRIVACY_ACCEPTED).toBe("deveco_code_privacy_accepted")
    expect(typeof KV_DEVECO_CODE_PRIVACY_ACCEPTED).toBe("string")
  })
})
