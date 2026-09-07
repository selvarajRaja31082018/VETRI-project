'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const service = require('../services/meetingService');
const { auditContext } = require('../utils/audit');

const ctx = (req) => ({ ...auditContext(req), userId: req.user.id });

const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.validatedQuery || req.query, req.user);
  paginated(res, result);
});

const getOne = asyncHandler(async (req, res) => {
  const meeting = await service.getById(req.params.id, req.user);
  success(res, meeting);
});

const start = asyncHandler(async (req, res) => {
  const meeting = await service.start(req.body.visitorRequestId, ctx(req), req.user);
  created(res, meeting, 'Meeting started');
});

const complete = asyncHandler(async (req, res) => {
  const meeting = await service.complete(req.params.id, req.body, ctx(req), req.user);
  success(res, meeting, 'Meeting completed');
});

module.exports = { list, getOne, start, complete };
