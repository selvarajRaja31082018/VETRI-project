'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const repo = require('../repositories/masterDataRepository');
const { writeAudit } = require('../utils/audit');

async function listRepresentatives() {
  return repo.listRepresentatives();
}

async function listDepartments() {
  return repo.listDepartments();
}

async function addDepartment(name, context) {
  const departments = await repo.listDepartments({ activeOnly: false });
  if (departments.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
    throw ApiError.conflict('This department already exists');
  }
  const id = await db.transaction(async (tx) => {
    const newId = await repo.createDepartment(tx, name);
    await writeAudit(tx, context, {
      action: 'DEPARTMENT_CREATED',
      entityType: 'department',
      entityId: newId,
      newValue: { name },
    });
    return newId;
  });
  return { id, name, is_active: 1 };
}

async function setDepartmentActive(id, isActive, context) {
  await db.transaction(async (tx) => {
    await repo.setDepartmentActive(tx, id, isActive);
    await writeAudit(tx, context, {
      action: isActive ? 'DEPARTMENT_ACTIVATED' : 'DEPARTMENT_DEACTIVATED',
      entityType: 'department',
      entityId: id,
    });
  });
}

async function listReasons(visitorType) {
  return repo.listReasons({ visitorType });
}

async function addReason({ visitorType, reason }, context) {
  const existing = await repo.listReasons({ visitorType, activeOnly: false });
  if (existing.some((r) => r.reason.toLowerCase() === reason.toLowerCase())) {
    throw ApiError.conflict('This reason already exists for the selected visitor type');
  }
  const id = await db.transaction(async (tx) => {
    const newId = await repo.createReason(tx, { visitorType, reason });
    await writeAudit(tx, context, {
      action: 'VISIT_REASON_CREATED',
      entityType: 'visit_reason',
      entityId: newId,
      newValue: { visitorType, reason },
    });
    return newId;
  });
  return { id, visitor_type: visitorType, reason, is_active: 1 };
}

async function setReasonActive(id, isActive, context) {
  await db.transaction(async (tx) => {
    await repo.setReasonActive(tx, id, isActive);
    await writeAudit(tx, context, {
      action: isActive ? 'VISIT_REASON_ACTIVATED' : 'VISIT_REASON_DEACTIVATED',
      entityType: 'visit_reason',
      entityId: id,
    });
  });
}

async function listSettings() {
  return repo.listSettings();
}

async function updateSetting(key, value, context) {
  await db.transaction(async (tx) => {
    await repo.upsertSetting(tx, key, value);
    await writeAudit(tx, context, {
      action: 'SETTING_UPDATED',
      entityType: 'setting',
      entityId: null,
      newValue: { key, value },
    });
  });
  return { key, value };
}

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
