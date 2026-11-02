export default class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    if (details !== undefined) this.details = details
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, details)
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message)
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message)
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message)
  }

  static conflict(message = 'Conflict', details) {
    return new ApiError(409, message, details)
  }

  static serviceUnavailable(message = 'Service unavailable', details) {
    return new ApiError(503, message, details)
  }
}
