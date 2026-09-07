'use strict';

const db = require('../config/db');

const BASE_SELECT = `
  SELECT m.id, m.visitor_request_id, m.representative_id, m.started_at, m.ended_at,
         m.remarks, m.resolution, m.status, m.created_at, m.updated_at,
         vr.request_code, vr.purpose, vr.status AS request_status, vr.priority,
         v.id AS visitor_id, v.visitor_code, v.name AS visitor_name, v.mobile AS visitor_mobile,
         u.name AS representative_name
  FROM meetings m
  JOIN visitor_requests vr ON vr.id = m.visitor_request_id
  JOIN visitors v ON v.id = vr.visitor_id
  JOIN representatives rep ON rep.id = m.representative_id
  JOIN users u ON u.id = rep.user_id
`;

async function findById(id, executor) {
  return (executor || db).queryOne(`${BASE_SELECT} WHERE m.id = ?`, [id]);
}

async function findByIdForUpdate(tx, id) {
  return tx.queryOne('SELECT * FROM meetings WHERE id = ? FOR UPDATE', [id]);
}

async function findActiveForRequest(executor, requestId) {
  return (executor || db).queryOne(
    `SELECT * FROM meetings WHERE visitor_request_id = ? AND status IN ('SCHEDULED', 'IN_PROGRESS')
     ORDER BY id DESC LIMIT 1`,
    [requestId],
  );
}

async function search({ representativeId, status, dateFrom, dateTo, today, search: term }, { limit, offset }) {
  const where = [];
  const params = [];

  if (representativeId) {
    where.push('m.representative_id = ?');
    params.push(representativeId);
  }
  if (status) {
    where.push('m.status = ?');
    params.push(status);
  }
  if (today) {
    where.push('DATE(m.created_at) = CURDATE()');
  }
  if (dateFrom) {
    where.push('m.created_at >= ?');
    params.push(`${dateFrom} 00:00:00`);
  }
  if (dateTo) {
    where.push('m.created_at <= ?');
    params.push(`${dateTo} 23:59:59`);
  }
  if (term) {
    where.push('(v.name LIKE ? OR v.mobile LIKE ? OR vr.request_code LIKE ?)');
    const like = `%${term}%`;
    params.push(like, like, like);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await db.query(
    `${BASE_SELECT} ${clause} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const { total } = await db.queryOne(
    `SELECT COUNT(*) AS total
     FROM meetings m
     JOIN visitor_requests vr ON vr.id = m.visitor_request_id
     JOIN visitors v ON v.id = vr.visitor_id
     ${clause}`,
    params,
  );
  return { rows, total };
}

async function create(executor, { visitorRequestId, representativeId, status }) {
  const result = await (executor || db).query(
    'INSERT INTO meetings (visitor_request_id, representative_id, status) VALUES (?, ?, ?)',
    [visitorRequestId, representativeId, status],
  );
  return result.insertId;
}

async function update(executor, id, fields) {
  const map = {
    startedAt: 'started_at',
    endedAt: 'ended_at',
    remarks: 'remarks',
    resolution: 'resolution',
    status: 'status',
  };
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(fields[key]);
    }
  }
  if (!sets.length) return;
  params.push(id);
  await (executor || db).query(`UPDATE meetings SET ${sets.join(', ')} WHERE id = ?`, params);
}

module.exports = { findById, findByIdForUpdate, findActiveForRequest, search, create, update };
