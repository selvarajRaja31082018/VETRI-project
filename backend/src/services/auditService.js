'use strict';

const auditRepository = require('../repositories/auditRepository');
const { getPagination } = require('../utils/pagination');

async function list(query) {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await auditRepository.search(
    {
      userId: query.userId,
      action: query.action,
      entityType: query.entityType,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    },
    { limit, offset },
  );
  return { rows, total, page, limit };
}

async function actions() {
  return auditRepository.distinctActions();
}

module.exports = { list, actions };
