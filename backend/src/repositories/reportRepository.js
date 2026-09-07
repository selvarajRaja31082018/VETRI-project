'use strict';

const db = require('../config/db');
const { buildFilters } = require('./visitorRequestRepository');

/** Daily visitor volume for the trend chart. */
async function visitorsByDay(days = 14) {
  return db.query(
    `SELECT DATE(requested_at) AS day, COUNT(*) AS total
     FROM visitor_requests
     WHERE deleted_at IS NULL AND requested_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(requested_at)
     ORDER BY day ASC`,
    [days],
  );
}

async function requestsByCategory(filters = {}) {
  const { clause, params } = buildFilters(filters);
  return db.query(
    `SELECT COALESCE(vr.grievance_category, vr.reason, 'Uncategorised') AS category, COUNT(*) AS total
     FROM visitor_requests vr
     JOIN visitors v ON v.id = vr.visitor_id
     ${clause}
     GROUP BY category
     ORDER BY total DESC`,
    params,
  );
}

async function representativePerformance(filters = {}) {
  const { clause, params } = buildFilters(filters);
  return db.query(
    `SELECT rep.id AS representative_id, u.name AS representative_name,
            COUNT(vr.id) AS assigned,
            SUM(CASE WHEN vr.status = 'RESOLVED' OR vr.status = 'CHECKED_OUT' THEN 1 ELSE 0 END) AS resolved,
            AVG(CASE WHEN vr.resolved_at IS NOT NULL
                     THEN TIMESTAMPDIFF(MINUTE, vr.requested_at, vr.resolved_at) END) AS avg_resolution_minutes
     FROM visitor_requests vr
     JOIN visitors v ON v.id = vr.visitor_id
     JOIN representatives rep ON rep.id = vr.representative_id
     JOIN users u ON u.id = rep.user_id
     ${clause}
     GROUP BY rep.id, u.name
     ORDER BY resolved DESC`,
    params,
  );
}

async function visitorReport(filters = {}, { limit, offset }) {
  const { clause, params } = buildFilters(filters);
  const rows = await db.query(
    `SELECT vr.request_code, v.visitor_code, v.name AS visitor_name, v.mobile, v.district,
            v.constituency, v.visitor_type, vr.purpose, vr.reason, vr.status, vr.priority,
            vr.group_size, vr.requested_at, vr.approved_at, vr.resolved_at,
            vr.checked_in_at, vr.checked_out_at,
            ru.name AS representative_name, d.name AS department_name, cu.name AS created_by_name
     FROM visitor_requests vr
     JOIN visitors v ON v.id = vr.visitor_id
     LEFT JOIN representatives rep ON rep.id = vr.representative_id
     LEFT JOIN users ru ON ru.id = rep.user_id
     LEFT JOIN users cu ON cu.id = vr.created_by
     LEFT JOIN departments d ON d.id = vr.department_id
     ${clause}
     ORDER BY vr.requested_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const { total } = await db.queryOne(
    `SELECT COUNT(*) AS total FROM visitor_requests vr JOIN visitors v ON v.id = vr.visitor_id ${clause}`,
    params,
  );
  return { rows, total };
}

async function meetingReport({ representativeId, dateFrom, dateTo }, { limit, offset }) {
  const where = [];
  const params = [];
  if (representativeId) {
    where.push('m.representative_id = ?');
    params.push(representativeId);
  }
  if (dateFrom) {
    where.push('m.created_at >= ?');
    params.push(`${dateFrom} 00:00:00`);
  }
  if (dateTo) {
    where.push('m.created_at <= ?');
    params.push(`${dateTo} 23:59:59`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await db.query(
    `SELECT vr.request_code, v.name AS visitor_name, v.mobile, u.name AS representative_name,
            m.started_at, m.ended_at, m.status, m.remarks, m.resolution,
            TIMESTAMPDIFF(MINUTE, m.started_at, m.ended_at) AS duration_minutes
     FROM meetings m
     JOIN visitor_requests vr ON vr.id = m.visitor_request_id
     JOIN visitors v ON v.id = vr.visitor_id
     JOIN representatives rep ON rep.id = m.representative_id
     JOIN users u ON u.id = rep.user_id
     ${clause}
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const { total } = await db.queryOne(`SELECT COUNT(*) AS total FROM meetings m ${clause}`, params);
  return { rows, total };
}

async function resolutionReport({ dateFrom, dateTo }) {
  const where = ['vr.deleted_at IS NULL', 'vr.resolved_at IS NOT NULL'];
  const params = [];
  if (dateFrom) {
    where.push('vr.resolved_at >= ?');
    params.push(`${dateFrom} 00:00:00`);
  }
  if (dateTo) {
    where.push('vr.resolved_at <= ?');
    params.push(`${dateTo} 23:59:59`);
  }
  return db.query(
    `SELECT COALESCE(c.category, vr.grievance_category, 'Uncategorised') AS category,
            COUNT(*) AS resolved,
            AVG(TIMESTAMPDIFF(HOUR, vr.requested_at, vr.resolved_at)) AS avg_hours
     FROM visitor_requests vr
     LEFT JOIN complaints c ON c.visitor_request_id = vr.id
     WHERE ${where.join(' AND ')}
     GROUP BY category
     ORDER BY resolved DESC`,
    params,
  );
}

module.exports = {
  visitorsByDay,
  requestsByCategory,
  representativePerformance,
  visitorReport,
  meetingReport,
  resolutionReport,
};
