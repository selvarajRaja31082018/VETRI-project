'use strict';

const db = require('../config/db');

/* ------------------------------------------------------------------ sessions */

async function createSession(session) {
  const result = await db.query(
    `INSERT INTO capture_sessions
       (session_id, created_by, purpose, status, max_devices, duplicate_scope, expires_at)
     VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?)`,
    [
      session.sessionId,
      session.createdBy,
      session.purpose,
      session.maxDevices,
      session.duplicateScope,
      session.expiresAt,
    ],
  );
  return result.insertId;
}

function findSessionByPublicId(sessionId) {
  return db.queryOne('SELECT * FROM capture_sessions WHERE session_id = ? LIMIT 1', [sessionId]);
}

async function markSessionStatus(sessionId, status) {
  await db.query(
    `UPDATE capture_sessions
        SET status = ?, closed_at = CASE WHEN ? IN ('CLOSED', 'EXPIRED') THEN NOW() ELSE closed_at END
      WHERE session_id = ?`,
    [status, status, sessionId],
  );
}

/** Sweep sessions whose TTL lapsed while nobody was looking. */
async function expireStaleSessions() {
  const result = await db.query(
    `UPDATE capture_sessions
        SET status = 'EXPIRED', closed_at = NOW()
      WHERE status = 'ACTIVE' AND expires_at < NOW()`,
  );
  return result.affectedRows || 0;
}

/* ------------------------------------------------------------------- devices */

async function createDevice(device) {
  const result = await db.query(
    `INSERT INTO capture_devices
       (device_id, capture_session_id, device_type, camera_type, device_label, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      device.deviceId,
      device.captureSessionId,
      device.deviceType,
      device.cameraType,
      device.deviceLabel,
      device.userAgent,
      device.ipAddress,
    ],
  );
  return result.insertId;
}

function findDeviceByPublicId(deviceId) {
  return db.queryOne('SELECT * FROM capture_devices WHERE device_id = ? LIMIT 1', [deviceId]);
}

function listDevices(captureSessionId) {
  return db.query(
    `SELECT device_id, device_type, camera_type, device_label, status,
            joined_at, last_seen_at, disconnected_at
       FROM capture_devices
      WHERE capture_session_id = ?
      ORDER BY joined_at ASC`,
    [captureSessionId],
  );
}

function countConnectedDevices(captureSessionId) {
  return db
    .queryOne(
      `SELECT COUNT(*) AS total FROM capture_devices
        WHERE capture_session_id = ? AND status = 'CONNECTED'`,
      [captureSessionId],
    )
    .then((row) => Number(row?.total || 0));
}

async function touchDevice(deviceId, patch = {}) {
  await db.query(
    `UPDATE capture_devices
        SET last_seen_at = NOW(),
            camera_type = COALESCE(?, camera_type),
            device_label = COALESCE(?, device_label)
      WHERE device_id = ?`,
    [patch.cameraType || null, patch.deviceLabel || null, deviceId],
  );
}

/** Bring a device that reconnected after a network blip back online. */
async function markDeviceConnected(deviceId) {
  await db.query(
    `UPDATE capture_devices
        SET status = 'CONNECTED', disconnected_at = NULL, last_seen_at = NOW()
      WHERE device_id = ?`,
    [deviceId],
  );
}

async function markDeviceDisconnected(deviceId) {
  await db.query(
    `UPDATE capture_devices
        SET status = 'DISCONNECTED', disconnected_at = NOW()
      WHERE device_id = ? AND status = 'CONNECTED'`,
    [deviceId],
  );
}

/** Mark devices that stopped heart-beating so the desktop can show them offline. */
async function reapStaleDevices(captureSessionId, timeoutSeconds) {
  const rows = await db.query(
    `SELECT device_id FROM capture_devices
      WHERE capture_session_id = ?
        AND status = 'CONNECTED'
        AND last_seen_at < (NOW() - INTERVAL ? SECOND)`,
    [captureSessionId, timeoutSeconds],
  );
  if (rows.length) {
    await db.query(
      `UPDATE capture_devices
          SET status = 'DISCONNECTED', disconnected_at = NOW()
        WHERE device_id IN (?)`,
      [rows.map((row) => row.device_id)],
    );
  }
  return rows.map((row) => row.device_id);
}

/* -------------------------------------------------------------------- images */

/**
 * Insert a capture. Pass `executor` (a transaction handle from db.transaction)
 * so the duplicate check and the insert commit as one unit.
 */
async function createImage(image, executor = db) {
  const result = await executor.query(
    `INSERT INTO captured_images
       (image_id, capture_session_id, capture_device_id, session_id, device_id,
        device_type, camera_type, file_name, file_path, file_url, mime_type,
        file_size, width, height, content_hash, perceptual_hash, image_signature,
        captured_at, captured_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      image.imageId,
      image.captureSessionId,
      image.captureDeviceId,
      image.sessionId,
      image.deviceId,
      image.deviceType,
      image.cameraType,
      image.fileName,
      image.filePath,
      image.fileUrl,
      image.mimeType,
      image.fileSize,
      image.width,
      image.height,
      image.contentHash,
      image.perceptualHash,
      image.signature,
      image.capturedAt,
      image.capturedBy,
    ],
  );
  return result.insertId;
}

const IMAGE_COLUMNS = `image_id, session_id, device_id, device_type, camera_type,
       file_url, file_path, mime_type, file_size, width, height,
       content_hash, perceptual_hash, captured_at, status`;

/** Comparison rows carry the signature blob; everything else does not, so a
 *  listing never drags 1KB per image across the wire. */
const COMPARISON_COLUMNS = `image_id, session_id, device_id, file_url,
       content_hash, perceptual_hash, image_signature, captured_at`;

function listImages(sessionId) {
  return db.query(
    `SELECT ${IMAGE_COLUMNS}
       FROM captured_images
      WHERE session_id = ? AND status <> 'DISCARDED'
      ORDER BY captured_at ASC`,
    [sessionId],
  );
}

function findImageByPublicId(imageId) {
  return db.queryOne(`SELECT ${IMAGE_COLUMNS} FROM captured_images WHERE image_id = ? LIMIT 1`, [imageId]);
}

/** Exact byte-for-byte match, restricted to the duplicate scope. */
function findByContentHash(contentHash, { sessionId, scope, sinceDays }, executor = db) {
  if (scope === 'GLOBAL') {
    return executor.queryOne(
      `SELECT ${COMPARISON_COLUMNS} FROM captured_images
        WHERE content_hash = ? AND status <> 'DISCARDED'
          AND captured_at >= (NOW() - INTERVAL ? DAY)
        ORDER BY captured_at ASC LIMIT 1`,
      [contentHash, sinceDays],
    );
  }
  return executor.queryOne(
    `SELECT ${COMPARISON_COLUMNS} FROM captured_images
      WHERE content_hash = ? AND session_id = ? AND status <> 'DISCARDED'
      ORDER BY captured_at ASC LIMIT 1`,
    [contentHash, sessionId],
  );
}

/**
 * Candidate rows for the near-identical comparison.
 *
 * Image similarity is not expressible as an index lookup, so the candidate set
 * is narrowed by scope and recency in SQL and the pixel comparison runs in JS.
 * Within a session that is a handful of rows; GLOBAL scope is capped so the
 * work stays bounded (each row carries a 1KB signature).
 */
function listComparisonCandidates({ sessionId, scope, sinceDays, limit = 500 }, executor = db) {
  if (scope === 'GLOBAL') {
    return executor.query(
      `SELECT ${COMPARISON_COLUMNS} FROM captured_images
        WHERE image_signature IS NOT NULL AND status <> 'DISCARDED'
          AND captured_at >= (NOW() - INTERVAL ? DAY)
        ORDER BY captured_at DESC LIMIT ?`,
      [sinceDays, limit],
    );
  }
  return executor.query(
    `SELECT ${COMPARISON_COLUMNS} FROM captured_images
      WHERE image_signature IS NOT NULL AND session_id = ? AND status <> 'DISCARDED'
      ORDER BY captured_at DESC LIMIT ?`,
    [sessionId, limit],
  );
}

/**
 * Take an exclusive lock on the session row for the duration of the enclosing
 * transaction. Captures into one session are therefore serialised, which makes
 * the "check for a duplicate, then insert" pair atomic - without it two devices
 * posting near-identical images at the same instant could both pass the check.
 * Byte-identical races are additionally caught by the unique index.
 */
function lockSessionForCapture(sessionId, executor) {
  return executor.queryOne('SELECT id FROM capture_sessions WHERE session_id = ? FOR UPDATE', [sessionId]);
}

/** Flip an image to ATTACHED once it has been bound to a visitor record. */
async function markImageStatus(imageId, status) {
  await db.query('UPDATE captured_images SET status = ? WHERE image_id = ?', [status, imageId]);
}

module.exports = {
  createSession,
  findSessionByPublicId,
  markSessionStatus,
  expireStaleSessions,
  createDevice,
  findDeviceByPublicId,
  listDevices,
  countConnectedDevices,
  touchDevice,
  markDeviceConnected,
  markDeviceDisconnected,
  reapStaleDevices,
  createImage,
  listImages,
  findImageByPublicId,
  findByContentHash,
  listComparisonCandidates,
  lockSessionForCapture,
  markImageStatus,
};
