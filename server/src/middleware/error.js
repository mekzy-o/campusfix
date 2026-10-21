/**
 * 404 and central error handlers. Every error leaves the API in the same
 * shape: { error: { message, details? } }.
 */
const multer = require('multer');
const config = require('../config');

function notFound(req, res) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let { message } = err;
  let { details } = err;

  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Each image must be 3 MB or smaller'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
        ? `You can upload at most ${config.uploads.maxFiles} images`
        : err.message;
  } else if (err.code === '23505') {
    // PostgreSQL unique violation
    status = 409;
    message = 'A record with the same unique value already exists';
    details = err.detail;
  } else if (err.code === '23503') {
    // PostgreSQL foreign key violation
    status = 409;
    message = 'This record is linked to other records and cannot be changed';
  } else if (err.code === '22P02') {
    // invalid text representation (e.g. malformed UUID)
    status = 400;
    message = 'Invalid identifier';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  }

  if (status >= 500) {
    console.error(err);
    if (config.isProd) message = 'Something went wrong on our side. Please try again.';
  }

  res.status(status).json({ error: { message, ...(details ? { details } : {}) } });
}

module.exports = { notFound, errorHandler };
