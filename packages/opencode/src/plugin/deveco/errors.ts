export class LoginCancelledError extends Error {
  constructor(message: string = "Login cancelled by user") {
    super(message)
    this.name = "LoginCancelledError"
  }
}

export class UnsupportedRegionError extends Error {
  constructor(message: string = "Unsupported region") {
    super(message)
    this.name = "UnsupportedRegionError"
  }
}
