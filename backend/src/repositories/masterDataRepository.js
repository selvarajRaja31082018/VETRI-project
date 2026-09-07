'use strict';

const db = require('../config/db');

// --- Representatives -------------------------------------------------------

async function listRepresentatives({ activeOnly = true } = {}) {
  return db.query(
    `SELECT rep.id, rep.user_id, rep.designation, rep.is_active, u.name, u.email, u.mobile
     FROM representatives rep
     JOIN users u ON u.id = rep.user_id
     ${activeOnly ? 'WHERE rep.is_active = 1 AND u.is_active = 1' : ''}
     ORDER BY u.name ASC`,
  );
}

async function findRepresentativeById(id, executor) {
  return (executor || db).queryOne(
    `SELECT rep.id, rep.user_id, rep.designation, rep.is_active, u.name
     FROM representatives rep JOIN users u ON u.id = rep.user_id
     WHERE rep.id = ?`,
    [id],
  );
}

async function createRepresentative(executor, { userId, designation }) {
  const result = await (executor || db).query(
    'INSERT INTO representatives (user_id, designation) VALUES (?, ?)',
    [userId, designation || null],
  );
  return result.insertId;
}

// --- Departments -----------------------------------------------------------

async function listDepartments({ activeOnly = true } = {}) {
  return db.query(
    `SELECT id, name, is_active, created_at FROM departments
     ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY name ASC`,
  );
}

async function createDepartment(executor, name) {
  const result = await (executor || db).query('INSERT INTO departments (name) VALUES (?)', [name]);
  return result.insertId;
}

async function setDepartmentActive(executor, id, isActive) {
  await (executor || db).query('UPDATE departments SET is_active = ? WHERE id = ?', [
    isActive ? 1 : 0,
    id,
  ]);
}

// --- Reason for visit ------------------------------------------------------

async function listReasons({ visitorType, activeOnly = true } = {}) {
  const where = [];
  const params = [];
  if (visitorType) {
    where.push('visitor_type = ?');
    params.push(visitorType);
  }
  if (activeOnly) where.push('is_active = 1');
  return db.query(
    `SELECT id, visitor_type, reason, is_active FROM visit_reasons
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY visitor_type ASC, reason ASC`,
    params,
  );
}

async function createReason(executor, { visitorType, reason }) {
  const result = await (executor || db).query(
    'INSERT INTO visit_reasons (visitor_type, reason) VALUES (?, ?)',
    [visitorType, reason],
  );
  return result.insertId;
}

async function setReasonActive(executor, id, isActive) {
  await (executor || db).query('UPDATE visit_reasons SET is_active = ? WHERE id = ?', [
    isActive ? 1 : 0,
    id,
  ]);
}

// --- Settings --------------------------------------------------------------

async function listSettings() {
  return db.query('SELECT setting_key, setting_value, updated_at FROM settings ORDER BY setting_key');
}

async function upsertSetting(executor, key, value) {
  await (executor || db).query(
    `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value],
  );
}

module.exports = {
  listRepresentatives,
  findRepresentativeById,
  createRepresentative,
  listDepartments,
  createDepartment,
  setDepartmentActive,
  listReasons,
  createReason,
  setReasonActive,
  listSettings,
  upsertSetting,
};
