'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { success, created } = require('../utils/response');
const service = require('../services/masterDataService');
const { auditContext } = require('../utils/audit');

const ctx = (req) => ({ ...auditContext(req), userId: req.user.id });

const listRepresentatives = asyncHandler(async (req, res) => {
  success(res, await service.listRepresentatives());
});

const listDepartments = asyncHandler(async (req, res) => {
  success(res, await service.listDepartments());
});

const addDepartment = asyncHandler(async (req, res) => {
  const department = await service.addDepartment(req.body.name, ctx(req));
  created(res, department, 'Department added');
});

const setDepartmentActive = asyncHandler(async (req, res) => {
  await service.setDepartmentActive(req.params.id, req.body.isActive, ctx(req));
  success(res, null, 'Department updated');
});

const listReasons = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  success(res, await service.listReasons(query.visitorType));
});

const addReason = asyncHandler(async (req, res) => {
  const reason = await service.addReason(req.body, ctx(req));
  created(res, reason, 'Reason added');
});

const setReasonActive = asyncHandler(async (req, res) => {
  await service.setReasonActive(req.params.id, req.body.isActive, ctx(req));
  success(res, null, 'Reason updated');
});

const listSettings = asyncHandler(async (req, res) => {
  success(res, await service.listSettings());
});

const updateSetting = asyncHandler(async (req, res) => {
  const setting = await service.updateSetting(req.params.key, req.body.value, ctx(req));
  success(res, setting, 'Setting updated');
});

module.exports = {
  listRepresentatives,
  listDepartments,
  addDepartment,
  setDepartmentActive,
  listReasons,
  addReason,
  setReasonActive,
  listSettings,
  updateSetting,
};
