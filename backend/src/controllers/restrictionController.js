'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const service = require('../services/restrictionService');
const { auditContext } = require('../utils/audit');

const ctx = (req) => ({ ...auditContext(req), userId: req.user.id });

const list = asyncHandler(async (req, res) => {
  success(res, await service.list());
});

const restrict = asyncHandler(async (req, res) => {
  const list_ = await service.restrict(req.params.id, req.body, ctx(req));
  success(res, list_, 'Visitor added to restricted list');
});

const recordAttempt = asyncHandler(async (req, res) => {
  const result = await service.recordAttempt(req.params.id, ctx(req));
  success(res, result, 'Attempted entry recorded');
});

const release = asyncHandler(async (req, res) => {
  const list_ = await service.release(req.params.id, ctx(req));
  success(res, list_, 'Restriction released');
});

module.exports = { list, restrict, recordAttempt, release };
