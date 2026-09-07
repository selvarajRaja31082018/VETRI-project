'use strict';

/** Application error carrying an HTTP status and a stable machine-readable code. */
class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Invalid request', details = []) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'You are not allowed to perform this action') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'Resource already exists') {
    return new ApiError(409, 'CONFLICT', message);
  }

  /** Business rule violation (valid syntax, invalid in the current state). */
  static unprocessable(message = 'Action is not allowed in the current state') {
    return new ApiError(422, 'BUSINESS_RULE_VIOLATION', message);
  }
}

module.exports = ApiError;
