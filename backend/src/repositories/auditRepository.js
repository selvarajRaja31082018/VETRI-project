'use strict';

const db = require('../config/db');

async function search({ userId, action, entityType, dateFrom, dateTo }, { limit, offset }) {
  const where = [];
  const params = [];

  if (userId) {
    where.push('a.user_id = ?');
    params.push(userId);
  }
  if (action) {
    where.push('a.action = ?');
    params.push(action);
  }
  if (entityType) {
    where.push('a.entity_type = ?');
    params.push(entityType);
  }
  if (dateFrom) {
    where.push('a.created_at >= ?');
    params.push(`${dateFrom} 00:00:00`);
  }
  if (dateTo) {
    where.push('a.created_at <= ?');
    params.push(`${dateTo} 23:59:59`);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await db.query(
    `SELECT a.id, a.user_id, u.name AS user_name, a.action, a.entity_type, a.entity_id,
            a.old_value, a.new_value, a.ip_address, a.user_agent, a.created_at
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${clause}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const { total } = await db.queryOne(
    `SELECT COUNT(*) AS total FROM audit_logs a ${clause}`,
    params,
  );
  return { rows, total };
}

async function distinctActions() {
  const rows = await db.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  return rows.map((row) => row.action);
}

module.exports = { search, distinctActions };
