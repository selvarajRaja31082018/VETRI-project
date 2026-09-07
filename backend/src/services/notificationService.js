'use strict';

const db = require('../config/db');

async function notifyRepresentative(representativeId, { title, message }) {
  const rep = await db.queryOne('SELECT user_id FROM representatives WHERE id = ?', [representativeId]);
  if (!rep) return;
  await notifyUser(rep.user_id, { title, message });
}

async function notifyUser(userId, { title, message }) {
  await db.query(
    'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
    [userId, title, message],
  );
}

async function listForUser(userId, { unreadOnly } = {}) {
  const where = ['user_id = ?'];
  const params = [userId];
  if (unreadOnly) where.push('is_read = 0');
  return db.query(
    `SELECT id, title, message, is_read, created_at, read_at FROM notifications
     WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 50`,
    params,
  );
}

async function markRead(userId, id) {
  await db.query(
    'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
    [id, userId],
  );
}

module.exports = { notifyRepresentative, notifyUser, listForUser, markRead };
