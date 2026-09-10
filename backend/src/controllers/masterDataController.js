'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { success, created } = require('../utils/response');
const service = require('../services/masterDataService');
const { auditContext } = require('../utils/audit');
const { PERMISSIONS } = require('../utils/constants');

const ctx = (req) => ({ ...auditContext(req), userId: req.user.id });

// Only the Admin configuration screen is allowed to see inactive entries -
// every other consumer (Gate/PA/Representative dropdowns) always gets the
// active-only list, even if it tries to pass the query param itself.
const canSeeInactive = (req) => req.query.includeInactive === 'true' && req.user.permissions.includes(PERMISSIONS.MASTER_DATA_MANAGE);

const listRepresentatives = asyncHandler(async (req, res) => {
  success(res, await service.listRepresentatives());
});

const listDepartments = asyncHandler(async (req, res) => {
  success(res, await service.listDepartments({ includeInactive: canSeeInactive(req) }));
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
  success(res, await service.listReasons(query.visitorType, { includeInactive: canSeeInactive(req) }));
});

const addReason = asyncHandler(async (req, res) => {
  const reason = await service.addReason(req.body, ctx(req));
  created(res, reason, 'Reason added');
});

const setReasonActive = asyncHandler(async (req, res) => {
  await service.setReasonActive(req.params.id, req.body.isActive, ctx(req));
  success(res, null, 'Reason updated');
});

const resetToDefaults = asyncHandler(async (req, res) => {
  const result = await service.resetToDefaults(ctx(req));
  success(res, result, 'Master data reset to defaults');
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
  resetToDefaults,
  listSettings,
  updateSetting,
};
