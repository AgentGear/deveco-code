// Session tracking: maps x-deveco-session / x-session-affinity header values
// to stable Chat-Id values used by the DevEco Code API.
export const sessionChatIdMap = new Map<string, string>()
