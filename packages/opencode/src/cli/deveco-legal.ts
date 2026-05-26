/**
 * Built-in defaults for DevEco Code agreement/legal configuration.
 * These values are used when no `agreement` section is present in the project config.
 * Override them in `.deveco/deveco.json` or project-level `deveco.json` under the `agreement` key.
 */
export const AGREEMENT_DEFAULTS = {
  /** TMS agreement service API base URL. */
  tms_url: "https://terms-drcn.platform.dbankcloud.cn/agreementservice/user",
  /** DevEco Code AI privacy statement URL. */
  privacy_url:
    "https://legal.cloud.huawei.com/terms/scope/huawei/deveco-studio/ai-privacy-statement.htm?code=CN&language=zh-CN&branchid=0&contenttag=default",
  /** DevEco Code AI user agreement URL. */
  terms_url:
    "https://legal.cloud.huawei.com/terms/scope/huawei/deveco-studio/ai-terms.htm?code=CN&language=zh-CN&branchid=0&contenttag=default",
  /** Privacy agreement ID for TMS query. */
  privacy_id: "10669",
  /** Terms of use agreement ID for TMS query. */
  terms_id: "30000092",
}

/**
 * Agreement config shape — matches the `agreement` section in `deveco.json` config.
 * All fields are optional; missing ones fall back to AGREEMENT_DEFAULTS.
 */
export interface AgreementConfig {
  tms_url?: string
  privacy_url?: string
  terms_url?: string
  privacy_id?: string
  terms_id?: string
}

/**
 * Merge user-provided config overrides with built-in defaults.
 * Any field present in `config` takes precedence; absent fields use AGREEMENT_DEFAULTS.
 */
export function resolveAgreementConfig(config?: AgreementConfig): {
  tms_url: string
  privacy_url: string
  terms_url: string
  privacy_id: string
  terms_id: string
} {
  return {
    tms_url: config?.tms_url ?? AGREEMENT_DEFAULTS.tms_url,
    privacy_url: config?.privacy_url ?? AGREEMENT_DEFAULTS.privacy_url,
    terms_url: config?.terms_url ?? AGREEMENT_DEFAULTS.terms_url,
    privacy_id: config?.privacy_id ?? AGREEMENT_DEFAULTS.privacy_id,
    terms_id: config?.terms_id ?? AGREEMENT_DEFAULTS.terms_id,
  }
}

/**
 * Persisted when remote agreement signing succeeds (used as fallback when API unreachable).
 * This is a local cache key name, not a per-project configurable value.
 */
export const KV_DEVECO_CODE_PRIVACY_ACCEPTED = "deveco_code_privacy_accepted"