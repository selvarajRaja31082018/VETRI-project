'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const visitorRepository = require('../repositories/visitorRepository');
const { writeAudit } = require('../utils/audit');

async function list() {
  return db.query(
    `SELECT re.id, re.visitor_id, re.reason, re.restricted_from, re.attempted_entries, re.is_active,
            re.created_at, v.name AS visitor_name, v.mobile, v.visitor_code
     FROM restricted_entries re
     JOIN visitors v ON v.id = re.visitor_id
     WHERE re.is_active = 1
     ORDER BY re.created_at DESC`,
  );
}

async function restrict(visitorId, { reason, restrictedFrom }, context) {
  const visitor = await visitorRepository.findById(visitorId);
  if (!visitor) throw ApiError.notFound('Visitor not found');

  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO restricted_entries (visitor_id, reason, restricted_from, created_by)
       VALUES (?, ?, ?, ?)`,
      [visitorId, reason, restrictedFrom || new Date().toISOString().slice(0, 10), context.userId],
    );
    await visitorRepository.update(tx, visitorId, { isRestricted: true });
    await writeAudit(tx, context, {
      action: 'VISITOR_RESTRICTED',
      entityType: 'visitor',
      entityId: visitorId,
      newValue: { reason },
    });
  });

  return list();
}

/** Recorded by the Gate Operator when a restricted visitor attempts entry. */
async function recordAttempt(visitorId, context) {
  const restriction = await db.queryOne(
    'SELECT id FROM restricted_entries WHERE visitor_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1',
    [visitorId],
  );
  if (!restriction) throw ApiError.badRequest('This visitor is not currently restricted');

  await db.transaction(async (tx) => {
    await tx.query(
      'UPDATE restricted_entries SET attempted_entries = attempted_entries + 1 WHERE id = ?',
      [restriction.id],
    );
    await writeAudit(tx, context, {
      action: 'RESTRICTED_ENTRY_ATTEMPT',
      entityType: 'visitor',
      entityId: visitorId,
    });
  });

  return { recorded: true };
}

async function release(visitorId, context) {
  await db.transaction(async (tx) => {
    await tx.query(
      'UPDATE restricted_entries SET is_active = 0 WHERE visitor_id = ? AND is_active = 1',
      [visitorId],
    );
    await visitorRepository.update(tx, visitorId, { isRestricted: false });
    await writeAudit(tx, context, {
      action: 'VISITOR_RESTRICTION_RELEASED',
      entityType: 'visitor',
      entityId: visitorId,
    });
  });
  return list();
}

module.exports = { list, restrict, recordAttempt, release };
