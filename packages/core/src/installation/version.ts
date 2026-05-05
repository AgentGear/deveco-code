declare global {
  const CODEGENIE_VERSION: string
  const CODEGENIE_CHANNEL: string
}

export const InstallationVersion = typeof CODEGENIE_VERSION === "string" ? CODEGENIE_VERSION : "local"
export const InstallationChannel = typeof CODEGENIE_CHANNEL === "string" ? CODEGENIE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
