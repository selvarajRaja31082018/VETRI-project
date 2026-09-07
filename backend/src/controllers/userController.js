'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const service = require('../services/userService');
const { auditContext } = require('../utils/audit');

const ctx = (req) => ({ ...auditContext(req), userId: req.user.id });

const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.validatedQuery || req.query);
  paginated(res, result);
});

const getOne = asyncHandler(async (req, res) => {
  const user = await service.getById(req.params.id);
  success(res, user);
});

const create = asyncHandler(async (req, res) => {
  const user = await service.create(req.body, ctx(req));
  created(res, user, 'User created');
});

const update = asyncHandler(async (req, res) => {
  const user = await service.update(req.params.id, req.body, ctx(req));
  success(res, user, 'User updated');
});

const setStatus = asyncHandler(async (req, res) => {
  const user = await service.setStatus(req.params.id, req.body.isActive, ctx(req));
  success(res, user, req.body.isActive ? 'User activated' : 'User deactivated');
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await service.resetPassword(req.params.id, ctx(req));
  success(res, result, 'Password reset');
});

module.exports = { list, getOne, create, update, setStatus, resetPassword };
