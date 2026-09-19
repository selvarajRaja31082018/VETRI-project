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

async function createImage(image) {
  const result = await db.query(
    `INSERT INTO captured_images
       (image_id, capture_session_id, capture_device_id, session_id, device_id,
        device_type, camera_type, file_name, file_path, file_url, mime_type,
        file_size, width, height, content_hash, perceptual_hash, captured_at, captured_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      image.capturedAt,
      image.capturedBy,
    ],
  );
  return result.insertId;
}

const IMAGE_COLUMNS = `image_id, session_id, device_id, device_type, camera_type,
       file_url, file_path, mime_type, file_size, width, height,
       content_hash, perceptual_hash, captured_at, status`;

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
function findByContentHash(contentHash, { sessionId, scope, sinceDays }) {
  if (scope === 'GLOBAL') {
    return db.queryOne(
      `SELECT ${IMAGE_COLUMNS} FROM captured_images
        WHERE content_hash = ? AND status <> 'DISCARDED'
          AND captured_at >= (NOW() - INTERVAL ? DAY)
        ORDER BY captured_at ASC LIMIT 1`,
      [contentHash, sinceDays],
    );
  }
  return db.queryOne(
    `SELECT ${IMAGE_COLUMNS} FROM captured_images
      WHERE content_hash = ? AND session_id = ? AND status <> 'DISCARDED'
      ORDER BY captured_at ASC LIMIT 1`,
    [contentHash, sessionId],
  );
}

/**
 * Candidate rows for the near-duplicate (Hamming) comparison. Hamming distance
 * is not expressible as an index lookup in MySQL, so the candidate set is
 * narrowed by scope and time first and compared in JS. For a session that is a
 * handful of rows; the GLOBAL scope is capped so the comparison stays bounded.
 */
function listPerceptualCandidates({ sessionId, scope, sinceDays, limit = 500 }) {
  if (scope === 'GLOBAL') {
    return db.query(
      `SELECT ${IMAGE_COLUMNS} FROM captured_images
        WHERE perceptual_hash IS NOT NULL AND status <> 'DISCARDED'
          AND captured_at >= (NOW() - INTERVAL ? DAY)
        ORDER BY captured_at DESC LIMIT ?`,
      [sinceDays, limit],
    );
  }
  return db.query(
    `SELECT ${IMAGE_COLUMNS} FROM captured_images
      WHERE perceptual_hash IS NOT NULL AND session_id = ? AND status <> 'DISCARDED'
      ORDER BY captured_at DESC LIMIT ?`,
    [sessionId, limit],
  );
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
  listPerceptualCandidates,
  markImageStatus,
};
