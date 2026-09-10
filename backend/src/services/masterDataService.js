'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const repo = require('../repositories/masterDataRepository');
const { writeAudit } = require('../utils/audit');
const { DEFAULT_DEPARTMENTS, DEFAULT_REASONS } = require('../utils/masterDataDefaults');

async function listRepresentatives() {
  return repo.listRepresentatives();
}

async function listDepartments({ includeInactive } = {}) {
  return repo.listDepartments({ activeOnly: !includeInactive });
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

async function listReasons(visitorType, { includeInactive } = {}) {
  return repo.listReasons({ visitorType, activeOnly: !includeInactive });
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

/**
 * Restore the reason-for-visit and department master lists to their default
 * set. This never deletes rows (departments/reasons may already be
 * referenced by real visitor requests) - anything outside the default set is
 * deactivated instead, and every default entry is ensured to exist and be
 * active. Matches the prototype's "Reset demo data" for master lists without
 * risking real visitor/request history.
 */
async function resetToDefaults(context) {
  const allDepartments = await repo.listDepartments({ activeOnly: false });
  const allReasons = await repo.listReasons({ activeOnly: false });

  await db.transaction(async (tx) => {
    for (const dept of allDepartments) {
      const isDefault = DEFAULT_DEPARTMENTS.includes(dept.name);
      if (!isDefault && dept.is_active) {
        await repo.setDepartmentActive(tx, dept.id, false);
      }
    }
    const existingDeptNames = new Set(allDepartments.map((d) => d.name));
    for (const name of DEFAULT_DEPARTMENTS) {
      if (existingDeptNames.has(name)) {
        const existing = allDepartments.find((d) => d.name === name);
        if (!existing.is_active) await repo.setDepartmentActive(tx, existing.id, true);
      } else {
        await repo.createDepartment(tx, name);
      }
    }

    const isDefaultReason = (r) => (DEFAULT_REASONS[r.visitor_type] || []).includes(r.reason);
    for (const reason of allReasons) {
      if (!isDefaultReason(reason) && reason.is_active) {
        await repo.setReasonActive(tx, reason.id, false);
      }
    }
    for (const [visitorType, reasons] of Object.entries(DEFAULT_REASONS)) {
      for (const reasonText of reasons) {
        const existing = allReasons.find((r) => r.visitor_type === visitorType && r.reason === reasonText);
        if (existing) {
          if (!existing.is_active) await repo.setReasonActive(tx, existing.id, true);
        } else {
          await repo.createReason(tx, { visitorType, reason: reasonText });
        }
      }
    }

    await writeAudit(tx, context, {
      action: 'MASTER_DATA_RESET',
      entityType: 'master_data',
    });
  });

  return { departments: await repo.listDepartments({ activeOnly: false }), reasons: await repo.listReasons({ activeOnly: false }) };
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
  resetToDefaults,
  listSettings,
  updateSetting,
};
