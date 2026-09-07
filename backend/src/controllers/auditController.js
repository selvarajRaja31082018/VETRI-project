'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { success, paginated } = require('../utils/response');
const service = require('../services/auditService');

const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.validatedQuery || req.query);
  paginated(res, result);
});

const actions = asyncHandler(async (req, res) => {
  success(res, await service.actions());
});

module.exports = { list, actions };
