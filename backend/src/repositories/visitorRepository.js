'use strict';

const db = require('../config/db');

const BASE_SELECT = `
  SELECT v.id, v.visitor_code, v.name, v.mobile, v.address, v.district, v.constituency,
         v.visitor_type, v.identity_type, v.identity_reference, v.photo_url, v.is_restricted,
         v.created_at, v.updated_at
  FROM visitors v
`;

async function findById(id) {
  return db.queryOne(`${BASE_SELECT} WHERE v.id = ? AND v.deleted_at IS NULL`, [id]);
}

async function findByMobile(mobile) {
  return db.queryOne(
    `${BASE_SELECT} WHERE v.mobile = ? AND v.deleted_at IS NULL ORDER BY v.id DESC LIMIT 1`,
    [mobile],
  );
}

async function search({ search, isRestricted, limit, offset }) {
  const where = ['v.deleted_at IS NULL'];
  const params = [];

  if (search) {
    where.push('(v.name LIKE ? OR v.mobile LIKE ? OR v.visitor_code LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (isRestricted !== undefined) {
    where.push('v.is_restricted = ?');
    params.push(isRestricted ? 1 : 0);
  }

  const clause = `WHERE ${where.join(' AND ')}`;
  const rows = await db.query(
    `${BASE_SELECT} ${clause} ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const { total } = await db.queryOne(`SELECT COUNT(*) AS total FROM visitors v ${clause}`, params);
  return { rows, total };
}

/** Generate the next visitor code (VT-0001) inside the caller's transaction. */
async function nextVisitorCode(executor) {
  const row = await (executor || db).queryOne(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(visitor_code, 4) AS UNSIGNED)), 0) AS last FROM visitors WHERE visitor_code LIKE 'VT-%'",
  );
  return `VT-${String(Number(row.last) + 1).padStart(4, '0')}`;
}

async function create(executor, visitor) {
  const runner = executor || db;
  const code = visitor.visitorCode || (await nextVisitorCode(executor));
  const result = await runner.query(
    `INSERT INTO visitors (visitor_code, name, mobile, address, district, constituency,
                           visitor_type, identity_type, identity_reference, photo_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      code,
      visitor.name,
      visitor.mobile,
      visitor.address || null,
      visitor.district || null,
      visitor.constituency || null,
      visitor.visitorType || null,
      visitor.identityType || null,
      visitor.identityReference || null,
      visitor.photoUrl || null,
    ],
  );
  return { id: result.insertId, visitorCode: code };
}

async function update(executor, id, fields) {
  const map = {
    name: 'name',
    mobile: 'mobile',
    address: 'address',
    district: 'district',
    constituency: 'constituency',
    visitorType: 'visitor_type',
    identityType: 'identity_type',
    identityReference: 'identity_reference',
    photoUrl: 'photo_url',
    isRestricted: 'is_restricted',
  };
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(typeof fields[key] === 'boolean' ? Number(fields[key]) : fields[key]);
    }
  }
  if (!sets.length) return;
  params.push(id);
  await (executor || db).query(`UPDATE visitors SET ${sets.join(', ')} WHERE id = ?`, params);
}

/** Prior engagement summary shown to the PA and the Representative. */
async function historyFor(visitorId) {
  return db.query(
    `SELECT vr.id, vr.request_code, vr.purpose, vr.status, vr.priority, vr.requested_at, vr.resolved_at,
            d.name AS department_name
     FROM visitor_requests vr
     LEFT JOIN departments d ON d.id = vr.department_id
     WHERE vr.visitor_id = ? AND vr.deleted_at IS NULL
     ORDER BY vr.requested_at DESC
     LIMIT 50`,
    [visitorId],
  );
}

module.exports = { findById, findByMobile, search, create, update, nextVisitorCode, historyFor };
