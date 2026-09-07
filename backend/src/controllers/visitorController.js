'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const visitorService = require('../services/visitorService');
const { auditContext } = require('../utils/audit');

const list = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await visitorService.list(query);
  paginated(res, result);
});

const getOne = asyncHandler(async (req, res) => {
  const visitor = await visitorService.getById(req.params.id);
  success(res, visitor);
});

const register = asyncHandler(async (req, res) => {
  const context = { ...auditContext(req), userId: req.user.id };
  const result = await visitorService.registerVisitor(req.body, context);
  created(res, result, 'Visitor registered and request submitted');
});

const update = asyncHandler(async (req, res) => {
  const context = { ...auditContext(req), userId: req.user.id };
  const visitor = await visitorService.updateVisitor(req.params.id, req.body, context);
  success(res, visitor, 'Visitor updated');
});

const lookup = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const visitor = await visitorService.lookupByMobile(query.mobile);
  success(res, visitor);
});

module.exports = { list, getOne, register, update, lookup };
