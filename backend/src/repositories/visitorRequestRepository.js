'use strict';

const db = require('../config/db');

const BASE_SELECT = `
  SELECT vr.id, vr.request_code, vr.visitor_id, vr.created_by, vr.purpose, vr.reason,
         vr.grievance_category, vr.person_to_meet, vr.representative_id, vr.department_id,
         vr.group_size, vr.status, vr.priority, vr.rejection_reason, vr.requested_at,
         vr.approved_at, vr.resolved_at, vr.checked_in_at, vr.checked_out_at,
         vr.created_at, vr.updated_at,
         v.visitor_code, v.name AS visitor_name, v.mobile AS visitor_mobile,
         v.district, v.constituency, v.visitor_type, v.photo_url, v.is_restricted,
         d.name AS department_name,
         ru.name AS representative_name,
         cu.name AS created_by_name
  FROM visitor_requests vr
  JOIN visitors v ON v.id = vr.visitor_id
  LEFT JOIN departments d ON d.id = vr.department_id
  LEFT JOIN representatives rep ON rep.id = vr.representative_id
  LEFT JOIN users ru ON ru.id = rep.user_id
  LEFT JOIN users cu ON cu.id = vr.created_by
`;

async function findById(id, executor) {
  return (executor || db).queryOne(`${BASE_SELECT} WHERE vr.id = ? AND vr.deleted_at IS NULL`, [id]);
}

/** Row-level lock for status transitions - must run inside a transaction. */
async function findByIdForUpdate(tx, id) {
  return tx.queryOne(
    'SELECT * FROM visitor_requests WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
    [id],
  );
}

function buildFilters(filters) {
  const where = ['vr.deleted_at IS NULL'];
  const params = [];

  if (filters.search) {
    where.push('(v.name LIKE ? OR v.mobile LIKE ? OR v.visitor_code LIKE ? OR vr.request_code LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like, like, like);
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    where.push(`vr.status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }
  if (filters.priority) {
    where.push('vr.priority = ?');
    params.push(filters.priority);
  }
  if (filters.representativeId) {
    where.push('vr.representative_id = ?');
    params.push(filters.representativeId);
  }
  if (filters.createdBy) {
    where.push('vr.created_by = ?');
    params.push(filters.createdBy);
  }
  if (filters.departmentId) {
    where.push('vr.department_id = ?');
    params.push(filters.departmentId);
  }
  if (filters.visitorId) {
    where.push('vr.visitor_id = ?');
    params.push(filters.visitorId);
  }
  if (filters.dateFrom) {
    where.push('vr.requested_at >= ?');
    params.push(`${filters.dateFrom} 00:00:00`);
  }
  if (filters.dateTo) {
    where.push('vr.requested_at <= ?');
    params.push(`${filters.dateTo} 23:59:59`);
  }
  if (filters.today) {
    where.push('DATE(vr.requested_at) = CURDATE()');
  }
  return { clause: `WHERE ${where.join(' AND ')}`, params };
}

async function search(filters, { limit, offset }) {
  const { clause, params } = buildFilters(filters);
  const rows = await db.query(
    `${BASE_SELECT} ${clause}
     ORDER BY FIELD(vr.priority, 'URGENT', 'HIGH', 'NORMAL', 'LOW'), vr.requested_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const { total } = await db.queryOne(
    `SELECT COUNT(*) AS total
     FROM visitor_requests vr
     JOIN visitors v ON v.id = vr.visitor_id
     ${clause}`,
    params,
  );
  return { rows, total };
}

async function nextRequestCode(executor) {
  const row = await (executor || db).queryOne(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(request_code, 4) AS UNSIGNED)), 0) AS last FROM visitor_requests WHERE request_code LIKE 'VR-%'",
  );
  return `VR-${String(Number(row.last) + 1).padStart(4, '0')}`;
}

async function create(executor, request) {
  const runner = executor || db;
  const code = await nextRequestCode(executor);
  const result = await runner.query(
    `INSERT INTO visitor_requests (request_code, visitor_id, created_by, purpose, reason,
                                   grievance_category, person_to_meet, representative_id,
                                   group_size, status, priority, requested_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      code,
      request.visitorId,
      request.createdBy,
      request.purpose,
      request.reason || null,
      request.grievanceCategory || null,
      request.personToMeet || null,
      request.representativeId || null,
      request.groupSize || 1,
      request.status,
      request.priority || 'NORMAL',
    ],
  );
  return { id: result.insertId, requestCode: code };
}

async function update(executor, id, fields) {
  const map = {
    purpose: 'purpose',
    reason: 'reason',
    grievanceCategory: 'grievance_category',
    personToMeet: 'person_to_meet',
    representativeId: 'representative_id',
    departmentId: 'department_id',
    status: 'status',
    priority: 'priority',
    rejectionReason: 'rejection_reason',
    approvedAt: 'approved_at',
    resolvedAt: 'resolved_at',
    checkedInAt: 'checked_in_at',
    checkedOutAt: 'checked_out_at',
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
  await (executor || db).query(`UPDATE visitor_requests SET ${sets.join(', ')} WHERE id = ?`, params);
}

async function addStatusHistory(executor, { requestId, oldStatus, newStatus, changedBy, remarks }) {
  await (executor || db).query(
    `INSERT INTO visitor_status_history (visitor_request_id, old_status, new_status, changed_by, remarks)
     VALUES (?, ?, ?, ?, ?)`,
    [requestId, oldStatus || null, newStatus, changedBy, remarks || null],
  );
}

async function statusHistory(requestId) {
  return db.query(
    `SELECT h.id, h.old_status, h.new_status, h.remarks, h.created_at, u.name AS changed_by_name
     FROM visitor_status_history h
     JOIN users u ON u.id = h.changed_by
     WHERE h.visitor_request_id = ?
     ORDER BY h.created_at ASC, h.id ASC`,
    [requestId],
  );
}

async function addGroupMembers(executor, requestId, members = []) {
  if (!members.length) return;
  const values = members.map((m) => [
    requestId,
    m.name,
    m.mobile || null,
    m.identityType || null,
    m.identityReference || null,
    m.address || null,
    m.photoUrl || null,
  ]);
  await (executor || db).query(
    `INSERT INTO visit_group_members
       (visitor_request_id, name, mobile, identity_type, identity_reference, address, photo_url)
     VALUES ?`,
    [values],
  );
}

async function groupMembers(requestId) {
  return db.query(
    `SELECT id, name, mobile, identity_type, identity_reference, address, photo_url
     FROM visit_group_members WHERE visitor_request_id = ? ORDER BY id ASC`,
    [requestId],
  );
}

/** Aggregate counts used by every dashboard. */
async function statusCounts(filters = {}) {
  const { clause, params } = buildFilters(filters);
  const rows = await db.query(
    `SELECT vr.status, COUNT(*) AS total
     FROM visitor_requests vr
     JOIN visitors v ON v.id = vr.visitor_id
     ${clause}
     GROUP BY vr.status`,
    params,
  );
  return rows.reduce((acc, row) => ({ ...acc, [row.status]: Number(row.total) }), {});
}

module.exports = {
  findById,
  findByIdForUpdate,
  search,
  create,
  update,
  addStatusHistory,
  statusHistory,
  addGroupMembers,
  groupMembers,
  statusCounts,
  buildFilters,
  nextRequestCode,
};
