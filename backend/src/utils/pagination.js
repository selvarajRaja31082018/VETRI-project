'use strict';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Normalise `page`/`limit` query params into safe integers. */
function getPagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.limit, 10) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, requested));
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { getPagination, DEFAULT_LIMIT, MAX_LIMIT };
