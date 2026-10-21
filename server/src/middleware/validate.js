/**
 * Request validation with Zod. Parsed (and type-coerced) values replace the
 * raw input, so handlers can trust req.body / req.validQuery / req.params.
 */
const HttpError = require('../utils/httpError');

function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || null,
    message: issue.message,
  }));
}

function validate({ body, query, params } = {}) {
  return (req, _res, next) => {
    const parts = [['body', body], ['query', query], ['params', params]];
    for (const [key, schema] of parts) {
      if (schema) {
        const result = schema.safeParse(req[key] || {});
        if (!result.success) {
          throw HttpError.badRequest('Validation failed', formatIssues(result.error));
        }
        // req.query is read-only in Express 5, so parsed queries go on req.validQuery.
        if (key === 'query') req.validQuery = result.data;
        else req[key] = result.data;
      }
    }
    next();
  };
}

module.exports = { validate, formatIssues };
