'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Validate `req.body`/`req.query`/`req.params` against zod schemas and replace
 * them with the parsed (coerced, stripped) values.
 */
function validate(schemas = {}) {
  return function validator(req, res, next) {
    const details = [];

    for (const source of ['body', 'query', 'params']) {
      const schema = schemas[source];
      if (!schema) continue;
      const result = schema.safeParse(req[source]);
      if (result.success) {
        if (source === 'query') {
          // req.query is a getter on some Express versions; expose a stable copy.
          req.validatedQuery = result.data;
          try {
            req.query = result.data;
          } catch {
            /* read-only in Express 5 - req.validatedQuery is the source of truth */
          }
        } else {
          req[source] = result.data;
        }
      } else {
        for (const issue of result.error.issues) {
          details.push({
            field: [source, ...issue.path].join('.'),
            message: issue.message,
          });
        }
      }
    }

    if (details.length) {
      return next(ApiError.badRequest('Request validation failed', details));
    }
    next();
  };
}

module.exports = { validate };
