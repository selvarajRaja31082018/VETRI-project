'use strict';

const db = require('../config/db');
const logger = require('./logger');

function serialise(value) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

/**
 * Extract actor + client details from the request so services can audit without
 * depending on Express objects.
 */
function auditContext(req) {
  return {
    userId: req.user ? req.user.id : null,
    ipAddress: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

/**
 * Write an audit record. Pass `executor` (a transaction handle) to make the
 * audit atomic with the change it describes.
 */
async function writeAudit(executor, context, { action, entityType, entityId, oldValue, newValue }) {
  const runner = executor || db;
  try {
    await runner.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        context.userId,
        action,
        entityType,
        entityId ?? null,
        serialise(oldValue),
        serialise(newValue),
        context.ipAddress,
        context.userAgent,
      ],
    );
  } catch (error) {
    // Auditing must never take down the request that succeeded.
    logger.error('Failed to write audit log', error);
    if (executor) throw error;
  }
}

module.exports = { auditContext, writeAudit };
