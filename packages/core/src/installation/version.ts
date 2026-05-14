declare global {
  const DEVECO_VERSION: string
  const DEVECO_CHANNEL: string
}

export const InstallationVersion = typeof DEVECO_VERSION === "string" ? DEVECO_VERSION : "local"
export const InstallationChannel = typeof DEVECO_CHANNEL === "string" ? DEVECO_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
