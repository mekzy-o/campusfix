/**
 * An error that carries an HTTP status code. Throw it anywhere in a route
 * and the central error handler turns it into a consistent JSON response.
 */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(msg, details) { return new HttpError(400, msg, details); }

  static unauthorized(msg = 'Authentication required') { return new HttpError(401, msg); }

  static forbidden(msg = 'You do not have permission to perform this action') { return new HttpError(403, msg); }

  static notFound(msg = 'Resource not found') { return new HttpError(404, msg); }

  static conflict(msg, details) { return new HttpError(409, msg, details); }
}

module.exports = HttpError;
