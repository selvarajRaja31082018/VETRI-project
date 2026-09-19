'use strict';

const crypto = require('crypto');

const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const repo = require('../repositories/captureRepository');
const bus = require('../realtime/sessionBus');
const captureToken = require('../utils/captureToken');
const { contentHash, normalisePerceptualHash, hammingDistance } = require('../utils/imageHash');
const { decodeBase64Image, writeImageBuffer, deleteStoredImage } = require('../utils/imageUpload');
const {
  CAPTURE_DEFAULTS,
  CAPTURE_SESSION_STATUS,
  CAPTURE_DEVICE_STATUS,
  DEVICE_TYPES,
  CAMERA_TYPES,
} = require('../utils/constants');

const DUPLICATE_MESSAGE = 'This photo has already been captured. Please capture a new photo.';
/** How far back the GLOBAL duplicate scope looks. */
const GLOBAL_SCOPE_DAYS = 30;

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60_000);
}

const asDeviceType = (value) => (DEVICE_TYPES.includes(value) ? value : 'UNKNOWN');
const asCameraType = (value) => (CAMERA_TYPES.includes(value) ? value : 'UNKNOWN');

function toSessionDto(row) {
  return {
    sessionId: row.session_id,
    status: row.status,
    purpose: row.purpose,
    maxDevices: row.max_devices,
    duplicateScope: row.duplicate_scope,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function toDeviceDto(row) {
  return {
    deviceId: row.device_id,
    deviceType: row.device_type,
    cameraType: row.camera_type,
    deviceLabel: row.device_label,
    status: row.status,
    joinedAt: row.joined_at,
    lastSeenAt: row.last_seen_at,
    disconnectedAt: row.disconnected_at,
  };
}

function toImageDto(row) {
  return {
    imageId: row.image_id,
    sessionId: row.session_id,
    deviceId: row.device_id,
    deviceType: row.device_type,
    cameraType: row.camera_type,
    url: row.file_url,
    filePath: row.file_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    width: row.width,
    height: row.height,
    capturedAt: row.captured_at,
    status: row.status,
  };
}

/**
 * Load a session and assert it can still accept traffic. Expiry is enforced on
 * read as well as by the sweep, so a lapsed session is never usable even if the
 * sweep has not run yet.
 */
async function requireActiveSession(sessionId) {
  const session = await repo.findSessionByPublicId(sessionId);
  if (!session) throw ApiError.notFound('Capture session not found');

  if (session.status === CAPTURE_SESSION_STATUS.ACTIVE && new Date(session.expires_at) <= new Date()) {
    await repo.markSessionStatus(sessionId, CAPTURE_SESSION_STATUS.EXPIRED);
    session.status = CAPTURE_SESSION_STATUS.EXPIRED;
  }
  if (session.status !== CAPTURE_SESSION_STATUS.ACTIVE) {
    throw ApiError.unprocessable(
      session.status === CAPTURE_SESSION_STATUS.EXPIRED
        ? 'This capture session has expired. Ask the operator for a new QR code.'
        : 'This capture session has been closed.',
    );
  }
  return session;
}

/* ------------------------------------------------------------------ sessions */

/** Desktop opens a session and gets back everything needed to render the QR. */
async function createSession(user, options = {}) {
  await repo.expireStaleSessions();

  const sessionId = crypto.randomUUID();
  const sessionTtl = options.ttlMinutes || CAPTURE_DEFAULTS.sessionTtlMinutes;
  const expiresAt = minutesFromNow(sessionTtl);
  const joinTtlMinutes = Math.min(CAPTURE_DEFAULTS.joinTtlMinutes, sessionTtl);

  await repo.createSession({
    sessionId,
    createdBy: user.id,
    purpose: options.purpose || 'VISITOR_REGISTRATION',
    maxDevices: options.maxDevices || CAPTURE_DEFAULTS.maxDevices,
    duplicateScope: options.duplicateScope === 'GLOBAL' ? 'GLOBAL' : 'SESSION',
    expiresAt,
  });

  const joinToken = captureToken.signJoinToken(sessionId, joinTtlMinutes * 60);
  const streamToken = captureToken.signStreamToken(sessionId, user.id, sessionTtl * 60);

  return {
    sessionId,
    status: CAPTURE_SESSION_STATUS.ACTIVE,
    expiresAt,
    joinExpiresAt: minutesFromNow(joinTtlMinutes),
    maxDevices: options.maxDevices || CAPTURE_DEFAULTS.maxDevices,
    // The token travels in the URL because a QR scan lands in a fresh browser
    // with no storage; it is short-lived and single-scope for that reason.
    joinUrl: `${env.publicAppUrl}/capture/${sessionId}?t=${encodeURIComponent(joinToken)}`,
    streamToken,
  };
}

/** Full session snapshot: used on desktop mount and to recover after a reload. */
async function getSessionState(sessionId, user) {
  const session = await repo.findSessionByPublicId(sessionId);
  if (!session) throw ApiError.notFound('Capture session not found');
  if (user && session.created_by !== user.id && user.roleCode !== 'A') {
    throw ApiError.forbidden('This capture session belongs to another operator');
  }

  const staleDeviceIds = await repo.reapStaleDevices(session.id, CAPTURE_DEFAULTS.heartbeatTimeoutSeconds);
  for (const deviceId of staleDeviceIds) {
    bus.publish(sessionId, bus.EVENTS.DEVICE_STATE, { deviceId, status: CAPTURE_DEVICE_STATUS.DISCONNECTED });
  }

  const [devices, images] = await Promise.all([repo.listDevices(session.id), repo.listImages(sessionId)]);
  return {
    session: toSessionDto(session),
    devices: devices.map(toDeviceDto),
    images: images.map(toImageDto),
  };
}

async function closeSession(sessionId, user) {
  const session = await repo.findSessionByPublicId(sessionId);
  if (!session) throw ApiError.notFound('Capture session not found');
  if (session.created_by !== user.id && user.roleCode !== 'A') {
    throw ApiError.forbidden('This capture session belongs to another operator');
  }

  await repo.markSessionStatus(sessionId, CAPTURE_SESSION_STATUS.CLOSED);
  bus.publish(sessionId, bus.EVENTS.SESSION_CLOSED, { sessionId, reason: 'CLOSED_BY_OPERATOR' });
  return { sessionId, status: CAPTURE_SESSION_STATUS.CLOSED };
}

/**
 * Re-issue a QR token for a still-open session, so the operator can refresh an
 * expired code without discarding the photos already captured.
 */
async function refreshJoinToken(sessionId, user) {
  const session = await requireActiveSession(sessionId);
  if (session.created_by !== user.id && user.roleCode !== 'A') {
    throw ApiError.forbidden('This capture session belongs to another operator');
  }

  const remainingMs = new Date(session.expires_at).getTime() - Date.now();
  const joinTtlMinutes = Math.max(1, Math.min(CAPTURE_DEFAULTS.joinTtlMinutes, Math.floor(remainingMs / 60_000)));
  const joinToken = captureToken.signJoinToken(sessionId, joinTtlMinutes * 60);

  return {
    sessionId,
    joinUrl: `${env.publicAppUrl}/capture/${sessionId}?t=${encodeURIComponent(joinToken)}`,
    joinExpiresAt: minutesFromNow(joinTtlMinutes),
  };
}

/* ------------------------------------------------------------------- devices */

/** A scanned phone posts here with its join token to become a session device. */
async function joinSession(sessionId, joinToken, deviceInfo, request) {
  const payload = captureToken.verifyJoinToken(joinToken);
  if (payload.sid !== sessionId) {
    throw ApiError.forbidden('This capture link does not match the session');
  }

  const session = await requireActiveSession(sessionId);

  await repo.reapStaleDevices(session.id, CAPTURE_DEFAULTS.heartbeatTimeoutSeconds);
  const connected = await repo.countConnectedDevices(session.id);
  if (connected >= session.max_devices) {
    throw ApiError.unprocessable(
      `This session already has ${session.max_devices} connected devices. Disconnect one and scan again.`,
    );
  }

  const deviceId = crypto.randomUUID();
  const device = {
    deviceId,
    captureSessionId: session.id,
    deviceType: asDeviceType(deviceInfo.deviceType),
    cameraType: asCameraType(deviceInfo.cameraType),
    deviceLabel: (deviceInfo.deviceLabel || '').slice(0, 150) || null,
    userAgent: (request.userAgent || '').slice(0, 255) || null,
    ipAddress: (request.ipAddress || '').slice(0, 45) || null,
  };
  await repo.createDevice(device);

  // The device token lives as long as the session, not as long as the QR code -
  // a phone that has already joined must not be kicked out when the code rolls.
  const remainingSeconds = Math.max(60, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
  const deviceToken = captureToken.signDeviceToken(sessionId, deviceId, remainingSeconds);

  const dto = {
    deviceId,
    deviceType: device.deviceType,
    cameraType: device.cameraType,
    deviceLabel: device.deviceLabel,
    status: CAPTURE_DEVICE_STATUS.CONNECTED,
    joinedAt: new Date().toISOString(),
  };
  bus.publish(sessionId, bus.EVENTS.DEVICE_JOINED, dto);
  logger.info(`Capture device ${deviceId} joined session ${sessionId}`);

  return {
    device: dto,
    deviceToken,
    session: toSessionDto(session),
    connectedDevices: connected + 1,
  };
}

/** Resolve the device behind a device token, rejecting stale/closed sessions. */
async function authenticateDevice(token) {
  const payload = captureToken.verifyDeviceToken(token);
  const device = await repo.findDeviceByPublicId(payload.did);
  if (!device) throw ApiError.unauthorized('This device is no longer part of the session');

  const session = await requireActiveSession(payload.sid);
  if (device.capture_session_id !== session.id) {
    throw ApiError.forbidden('Device does not belong to this session');
  }
  return { device, session };
}

async function heartbeat(device, session, patch = {}) {
  const wasDisconnected = device.status === CAPTURE_DEVICE_STATUS.DISCONNECTED;
  await repo.touchDevice(device.device_id, {
    cameraType: patch.cameraType ? asCameraType(patch.cameraType) : null,
    deviceLabel: patch.deviceLabel || null,
  });
  // A device that reconnects after a network blip comes back CONNECTED.
  if (wasDisconnected) await repo.markDeviceConnected(device.device_id);
  bus.publish(session.session_id, bus.EVENTS.DEVICE_STATE, {
    deviceId: device.device_id,
    status: CAPTURE_DEVICE_STATUS.CONNECTED,
    cameraType: patch.cameraType ? asCameraType(patch.cameraType) : device.camera_type,
  });
  return { deviceId: device.device_id, status: CAPTURE_DEVICE_STATUS.CONNECTED };
}

async function leaveSession(device, session) {
  await repo.markDeviceDisconnected(device.device_id);
  bus.publish(session.session_id, bus.EVENTS.DEVICE_LEFT, { deviceId: device.device_id });
  return { deviceId: device.device_id, status: CAPTURE_DEVICE_STATUS.DISCONNECTED };
}

/* -------------------------------------------------------- duplicate checking */

/**
 * Compare a new capture against what this session (or, in GLOBAL scope, the
 * recent past) already holds. Returns the matching image when it is a duplicate
 * and `null` when the photo is new.
 */
async function findDuplicate({ hash, perceptualHash, sessionId, scope }) {
  const exact = await repo.findByContentHash(hash, { sessionId, scope, sinceDays: GLOBAL_SCOPE_DAYS });
  if (exact) return { match: exact, reason: 'EXACT', distance: 0 };

  if (!perceptualHash) return null;

  const candidates = await repo.listPerceptualCandidates({ sessionId, scope, sinceDays: GLOBAL_SCOPE_DAYS });
  let best = null;
  for (const candidate of candidates) {
    const distance = hammingDistance(perceptualHash, candidate.perceptual_hash);
    if (distance === null) continue;
    if (distance <= CAPTURE_DEFAULTS.duplicateHammingThreshold && (!best || distance < best.distance)) {
      best = { match: candidate, reason: 'PERCEPTUAL', distance };
      if (distance === 0) break;
    }
  }
  return best;
}

/* -------------------------------------------------------------------- images */

/**
 * The single capture entry point shared by every device type: desktop webcam,
 * USB camera and scanned mobile all land here. Validates the payload, rejects
 * duplicates *before* writing any file, stores the image with its full device
 * provenance, and pushes the result to every subscriber of the session.
 *
 * `origin` is either `{ kind: 'device', device, session }` (mobile/USB that
 * joined via QR) or `{ kind: 'user', user, session }` (the logged-in desktop).
 */
async function submitCapture(origin, payload) {
  const session = origin.session;
  const sessionId = session ? session.session_id : null;
  const deviceId = origin.kind === 'device' ? origin.device.device_id : payload.deviceId || null;

  const deviceType =
    origin.kind === 'device' ? origin.device.device_type : asDeviceType(payload.deviceType || 'DESKTOP');
  const cameraType =
    origin.kind === 'device'
      ? asCameraType(payload.cameraType || origin.device.camera_type)
      : asCameraType(payload.cameraType || 'BUILTIN_WEBCAM');

  const { buffer, mimeType, extension } = decodeBase64Image(payload.image);
  const hash = contentHash(buffer);
  const perceptualHash = normalisePerceptualHash(payload.perceptualHash);

  const duplicate = await findDuplicate({
    hash,
    perceptualHash,
    sessionId,
    scope: session ? session.duplicate_scope : 'SESSION',
  });

  if (duplicate) {
    const event = {
      sessionId,
      deviceId,
      deviceType,
      cameraType,
      reason: duplicate.reason,
      distance: duplicate.distance,
      originalImageId: duplicate.match.image_id,
      originalUrl: duplicate.match.file_url,
      message: DUPLICATE_MESSAGE,
    };
    if (sessionId) bus.publish(sessionId, bus.EVENTS.IMAGE_DUPLICATE, event);
    // 409 so the client can branch on status without string-matching the body.
    throw new ApiError(409, 'DUPLICATE_IMAGE', DUPLICATE_MESSAGE, [
      { field: 'image', message: DUPLICATE_MESSAGE },
    ]);
  }

  const stored = writeImageBuffer({ buffer, extension, publicBaseUrl: payload.publicBaseUrl });
  const imageId = crypto.randomUUID();

  try {
    await repo.createImage({
      imageId,
      captureSessionId: session ? session.id : null,
      captureDeviceId: origin.kind === 'device' ? origin.device.id : null,
      sessionId,
      deviceId,
      deviceType,
      cameraType,
      fileName: stored.fileName,
      filePath: stored.filePath,
      fileUrl: stored.url,
      mimeType,
      fileSize: buffer.length,
      width: payload.width || null,
      height: payload.height || null,
      contentHash: hash,
      perceptualHash,
      capturedAt: new Date(),
      capturedBy: origin.kind === 'user' ? origin.user.id : session ? session.created_by : null,
    });
  } catch (error) {
    // Do not leave an orphan file behind if the row could not be written.
    deleteStoredImage(stored.fileName);
    throw error;
  }

  if (origin.kind === 'device') {
    await repo.touchDevice(origin.device.device_id, { cameraType });
  }

  const dto = {
    imageId,
    sessionId,
    deviceId,
    deviceType,
    cameraType,
    url: stored.url,
    filePath: stored.filePath,
    mimeType,
    fileSize: buffer.length,
    width: payload.width || null,
    height: payload.height || null,
    capturedAt: new Date().toISOString(),
    status: 'STORED',
  };

  if (sessionId) bus.publish(sessionId, bus.EVENTS.IMAGE_CAPTURED, dto);
  return dto;
}

module.exports = {
  DUPLICATE_MESSAGE,
  createSession,
  getSessionState,
  closeSession,
  refreshJoinToken,
  joinSession,
  authenticateDevice,
  heartbeat,
  leaveSession,
  submitCapture,
  requireActiveSession,
  toImageDto,
};
