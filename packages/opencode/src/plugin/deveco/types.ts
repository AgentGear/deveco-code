export interface UserInfo {
  userId: string
  userName: string
  accessToken: string
  refreshToken: string
  jwtToken: string
  countryCode: string
  language: string
  isRealName: boolean
  teamList?: Map<string, string>
  currentTeamId?: string
}

export interface LoginResult {
  success: boolean
  cancelled?: boolean
  userInfo?: UserInfo
  error?: string
  unsupportedRegion?: boolean
}

export interface TokenCheckResponse {
  status: boolean
  userInfo?: {
    accessToken: string
    refreshToken?: string
    nationalCode: string
    realName: string
  }
}

export interface JwtPayload {
  userId: string
  userName: string
  exp?: number
  iat?: number
}

export interface LoginConfig {
  baseUrl: string
  authUrl: string
  tempTokenCheckUrl: string
  jwtTokenCheckUrl: string
  successRedirectUrl: string
  failedRedirectUrl: string
  appId: string
  defaultPort: number
  timeout: number
}

export interface CallbackData {
  tempToken: string
  siteId: string
  quit?: string
}

export interface HttpResponse {
  data: string
  statusCode: number
  headers: import("http").IncomingHttpHeaders
}

export interface HttpRequestConfig {
  timeout?: number
  headers?: Record<string, string>
  params?: Record<string, string>
}

export interface DevEcoSession {
  userId: string
  userName: string
  accessToken: string
  refreshToken: string
  jwtToken: string
  countryCode: string
  language: string
  isRealName: boolean
  createdAt: number
  expiresAt: number
}

export const ACCESS_TOKEN_EXPIRES_MS = 30 * 60 * 1000 // 30 minutes

export const DEFAULT_CONFIG: LoginConfig = {
  baseUrl: "https://cn.devecostudio.huawei.com",
  authUrl: "console/DevEcoIDE/apply",
  tempTokenCheckUrl: "authrouter/auth/api/temptoken/check",
  jwtTokenCheckUrl: "authrouter/auth/api/jwToken/check",
  successRedirectUrl: "console/DevEcoCode/loginSuccess",
  failedRedirectUrl: "console/DevEcoCode/loginFailed",
  appId: "1008",
  defaultPort: 10101,
  timeout: 600000, // 10 minutes
}

export const PROVIDER_ID = "deveco"
