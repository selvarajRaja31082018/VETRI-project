'use strict';

const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logger = require('../utils/logger');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof ApiError)) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      error = ApiError.conflict('A record with these details already exists');
    } else if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
      error = ApiError.badRequest('Referenced record does not exist');
    } else if (err && err.type === 'entity.parse.failed') {
      error = ApiError.badRequest('Malformed JSON body');
    } else {
      error = new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  }

  if (error.status >= 500) {
    logger.error(`${req.method} ${req.originalUrl}`, err);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${error.status} ${error.code}: ${error.message}`);
  }

  const body = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details || [],
    },
  };

  if (!env.isProduction && error.status >= 500) {
    body.error.stack = err.stack;
  }

  res.status(error.status).json(body);
}

module.exports = { notFoundHandler, errorHandler };
