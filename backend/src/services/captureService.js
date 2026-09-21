'use strict';

const crypto = require('crypto');

const db = require('../config/db');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const repo = require('../repositories/captureRepository');
const bus = require('../realtime/sessionBus');
const captureToken = require('../utils/captureToken');
const { analyseImage, signatureDistance } = require('../utils/imageHash');
const { decodeUpload, writeImageBuffer, deleteStoredImage } = require('../utils/imageUpload');
const {
  CAPTURE_DEFAULTS,
  CAPTURE_SESSION_STATUS,
  CAPTURE_DEVICE_STATUS,
  DEVICE_TYPES,
  CAMERA_TYPES,
  IMAGE_STATUS,
} = require('../utils/constants');

const DUPLICATE_MESSAGE = 'This photo has already been captured. Please capture a new photo.';

/**
 * Thrown inside the capture transaction to roll it back. Carries the details of
 * the match so the caller can build the 409 body and the real-time event.
 */
class DuplicateCaptureError extends Error {
  constructor(outcome) {
    super(outcome.message);
    this.name = 'DuplicateCaptureError';
    this.outcome = outcome;
  }
}
/** How far back the GLOBAL duplicate scope looks. */
const GLOBAL_SCOPE_DAYS = 30;

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60_000);
}

/** The URL encoded into the QR code. Token only - nothing else. */
function buildJoinUrl(joinToken) {
  return `${env.publicAppUrl}/mobile-camera?t=${encodeURIComponent(joinToken)}`;
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
    // Exposed so the desktop can show/trace exactly which image a record is.
    imageHash: row.content_hash,
    perceptualHash: row.perceptual_hash,
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

  const joinToken = captureToken.signJoinToken(sessionId, joinTtlMinutes * 60);

  await repo.createSession({
    sessionId,
    createdBy: user.id,
    purpose: options.purpose || 'VISITOR_REGISTRATION',
    maxDevices: options.maxDevices || CAPTURE_DEFAULTS.maxDevices,
    duplicateScope: options.duplicateScope === 'GLOBAL' ? 'GLOBAL' : 'SESSION',
    expiresAt,
    tokenHash: captureToken.hashToken(joinToken),
  });

  const streamToken = captureToken.signStreamToken(sessionId, user.id, sessionTtl * 60);

  return {
    sessionId,
    status: CAPTURE_SESSION_STATUS.ACTIVE,
    expiresAt,
    joinExpiresAt: minutesFromNow(joinTtlMinutes),
    maxDevices: options.maxDevices || CAPTURE_DEFAULTS.maxDevices,
    // The QR carries only a short-lived, single-scope token - no session id,
    // no operator identity, nothing internal. The server derives the session
    // from the signed token when the device joins.
    joinUrl: buildJoinUrl(joinToken),
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
  // Overwriting the stored digest is what makes the previous QR stop working.
  await repo.updateSessionTokenHash(sessionId, captureToken.hashToken(joinToken));

  return {
    sessionId,
    joinUrl: buildJoinUrl(joinToken),
    joinExpiresAt: minutesFromNow(joinTtlMinutes),
  };
}

/* ------------------------------------------------------------------- devices */

/**
 * A scanned phone posts here with the token from the QR code.
 *
 * The session is derived from the signed token, never from the request - the
 * client cannot name the session it wants to join. The token is additionally
 * checked against the digest stored on the session, so a token from a QR that
 * has since been rotated is refused even while its JWT is still in date.
 */
async function joinSession(joinToken, deviceInfo, request) {
  const payload = captureToken.verifyJoinToken(joinToken);
  const session = await requireActiveSession(payload.sid);
  const sessionId = session.session_id;

  if (session.token_hash && session.token_hash !== captureToken.hashToken(joinToken)) {
    throw ApiError.unauthorized('This QR code is no longer valid. Ask the operator for a new one.');
  }

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
  bus.publish(sessionId, bus.EVENTS.DEVICE_CONNECTED, dto);
  logger.info(`Capture device ${deviceId} joined session ${sessionId}`);

  return {
    sessionId,
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

/**
 * Mark a device offline by its public ids. Used when a socket drops, where the
 * full device/session rows are not to hand - the ids come from the socket's
 * signed token, so they are already trusted.
 */
async function markDeviceDisconnected(sessionId, deviceId) {
  await repo.markDeviceDisconnected(deviceId);
  bus.publish(sessionId, bus.EVENTS.DEVICE_DISCONNECTED, { sessionId, deviceId });
}

async function leaveSession(device, session) {
  await repo.markDeviceDisconnected(device.device_id);
  bus.publish(session.session_id, bus.EVENTS.DEVICE_DISCONNECTED, { deviceId: device.device_id });
  return { deviceId: device.device_id, status: CAPTURE_DEVICE_STATUS.DISCONNECTED };
}

/* -------------------------------------------------------- duplicate checking */

/**
 * Decide whether this photo has already been captured.
 *
 * Runs entirely on server-computed fingerprints of the decoded pixels. It
 * compares IMAGES ONLY - never the visitor, member, name, mobile, device or
 * session behind them, and it does no face recognition. The same person
 * photographed a second time produces a different image and is saved.
 *
 * Returns the matching row when the photo is a duplicate, or null when it is new.
 */
async function findDuplicate({ fingerprints, sessionId, scope, executor }) {
  // 1. Byte-identical: the same file submitted twice.
  const exact = await repo.findByContentHash(
    fingerprints.contentHash,
    { sessionId, scope, sinceDays: GLOBAL_SCOPE_DAYS },
    executor,
  );
  if (exact) return { match: exact, reason: 'EXACT', distance: 0 };

  // 2. Visually identical: the same shot re-encoded, resized or re-saved.
  //    Skipped when the image could not be decoded, rather than guessed at.
  if (!fingerprints.signature) return null;

  const candidates = await repo.listComparisonCandidates(
    { sessionId, scope, sinceDays: GLOBAL_SCOPE_DAYS },
    executor,
  );

  let best = null;
  for (const candidate of candidates) {
    const distance = signatureDistance(fingerprints.signature, candidate.image_signature);
    if (distance === null) continue;
    if (distance <= CAPTURE_DEFAULTS.duplicateSignatureThreshold && (!best || distance < best.distance)) {
      best = { match: candidate, reason: 'NEAR_IDENTICAL', distance };
      if (distance === 0) break;
    }
  }
  return best;
}

/** Build the 409 payload and the matching real-time event for a rejected photo. */
function duplicateOutcome(duplicate, context) {
  return {
    ...context,
    reason: duplicate.reason,
    // Rounded: a raw float in an API response invites false precision.
    distance: duplicate.distance === null ? null : Number(duplicate.distance.toFixed(3)),
    originalImageId: duplicate.match.image_id,
    originalUrl: duplicate.match.file_url,
    originalCapturedAt: duplicate.match.captured_at,
    message: DUPLICATE_MESSAGE,
  };
}

/**
 * Record a rejected capture for auditing.
 *
 * The photo itself is NOT stored - no file is written, and the row carries no
 * path. It exists only so an operator can later see that a duplicate was
 * attempted, by which device and against which original. Written outside the
 * capture transaction (that one rolled back) and best-effort: an audit failure
 * must never turn a clean duplicate rejection into a server error.
 */
async function recordDuplicateAttempt({
  imageId,
  session,
  origin,
  context,
  fingerprints,
  mimeType,
  fileSize,
  capturedAt,
  duplicateOf,
}) {
  try {
    await repo.createImage({
      imageId,
      captureSessionId: session ? session.id : null,
      captureDeviceId: origin.kind === 'device' ? origin.device.id : null,
      sessionId: context.sessionId,
      deviceId: context.deviceId,
      deviceType: context.deviceType,
      cameraType: context.cameraType,
      fileName: null,
      filePath: null,
      fileUrl: null,
      mimeType,
      fileSize,
      width: fingerprints.width,
      height: fingerprints.height,
      contentHash: fingerprints.contentHash,
      perceptualHash: fingerprints.perceptualHash,
      signature: null,
      capturedAt,
      capturedBy: origin.kind === 'user' ? origin.user.id : session ? session.created_by : null,
      status: IMAGE_STATUS.DUPLICATE,
      duplicateOf,
    });
  } catch (error) {
    logger.warn('Could not record duplicate capture attempt', error.message);
  }
}

/* -------------------------------------------------------------------- images */

/**
 * The single capture entry point shared by every device type: desktop webcam,
 * USB camera and scanned mobile all land here.
 *
 * Order matters. The image is fingerprinted and checked against what is already
 * stored BEFORE anything is written, so a duplicate leaves no file on disk, no
 * database row, and produces no "photo received" event.
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

  // One decode path for both transports: multipart file or base64 data URL.
  const { buffer, mimeType, extension } = decodeUpload({ file: payload.file, dataUrl: payload.image });

  // Fingerprints are derived here, from the decoded pixels. Anything the client
  // sent about the image is metadata only and never influences the verdict.
  const fingerprints = await analyseImage(buffer);
  const scope = session ? session.duplicate_scope : 'SESSION';

  const context = { sessionId, deviceId, deviceType, cameraType };
  const imageId = crypto.randomUUID();
  const capturedAt = new Date();

  let stored = null;
  // Set once the transaction has committed. After that point the file belongs
  // to a persisted row, so no later failure may delete it.
  let committed = false;

  try {
    const dto = await db.transaction(async (tx) => {
      // Serialise captures within a session so "check then insert" is atomic.
      if (sessionId) await repo.lockSessionForCapture(sessionId, tx);

      const duplicate = await findDuplicate({ fingerprints, sessionId, scope, executor: tx });
      if (duplicate) throw new DuplicateCaptureError(duplicateOutcome(duplicate, context));

      stored = writeImageBuffer({
        buffer,
        extension,
        publicBaseUrl: payload.publicBaseUrl,
        sessionId,
        deviceId,
        imageId,
      });

      await repo.createImage(
        {
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
          width: fingerprints.width || payload.width || null,
          height: fingerprints.height || payload.height || null,
          contentHash: fingerprints.contentHash,
          perceptualHash: fingerprints.perceptualHash,
          signature: fingerprints.signature,
          capturedAt,
          capturedBy: origin.kind === 'user' ? origin.user.id : session ? session.created_by : null,
          status: IMAGE_STATUS.SUCCESS,
          duplicateOf: null,
        },
        tx,
      );

      return {
        imageId,
        sessionId,
        deviceId,
        deviceType,
        cameraType,
        url: stored.url,
        filePath: stored.filePath,
        mimeType,
        fileSize: buffer.length,
        width: fingerprints.width || payload.width || null,
        height: fingerprints.height || payload.height || null,
        imageHash: fingerprints.contentHash,
        perceptualHash: fingerprints.perceptualHash,
        capturedAt: capturedAt.toISOString(),
        status: IMAGE_STATUS.SUCCESS,
      };
    });
    committed = true;

    if (origin.kind === 'device') {
      await repo.touchDevice(origin.device.device_id, { cameraType });
    }

    // Broadcast only after the row is committed, so the desktop never renders a
    // photo that a rolled-back transaction did not actually store.
    if (sessionId) bus.publish(sessionId, bus.EVENTS.CAPTURE_SUCCESS, dto);
    return dto;
  } catch (error) {
    // Nothing partial is left behind: a duplicate never wrote a file, and a
    // rolled-back insert has its file removed here. Once the transaction has
    // committed the file is referenced by a real row, so a later failure
    // (a heartbeat update, a broadcast) must never remove it.
    if (stored && !committed) deleteStoredImage(stored.storageKey);

    if (error instanceof DuplicateCaptureError) {
      await recordDuplicateAttempt({
        imageId,
        session,
        origin,
        context,
        fingerprints,
        mimeType,
        fileSize: buffer.length,
        capturedAt,
        duplicateOf: error.outcome.originalImageId,
      });
      if (sessionId) bus.publish(sessionId, bus.EVENTS.CAPTURE_DUPLICATE, error.outcome);
      throw ApiError.duplicatePhoto(DUPLICATE_MESSAGE, error.outcome);
    }

    // The unique index is the last line of defence for two devices posting the
    // same bytes at the same instant; whichever loses the race reports it as
    // the duplicate it is, rather than a 500.
    if (error && error.code === 'ER_DUP_ENTRY') {
      const original = sessionId
        ? await repo.findByContentHash(fingerprints.contentHash, { sessionId, scope, sinceDays: GLOBAL_SCOPE_DAYS })
        : null;
      await recordDuplicateAttempt({
        imageId,
        session,
        origin,
        context,
        fingerprints,
        mimeType,
        fileSize: buffer.length,
        capturedAt,
        duplicateOf: original ? original.image_id : null,
      });
      const outcome = {
        ...context,
        reason: 'EXACT',
        distance: 0,
        originalImageId: original ? original.image_id : null,
        message: DUPLICATE_MESSAGE,
      };
      if (sessionId) bus.publish(sessionId, bus.EVENTS.CAPTURE_DUPLICATE, outcome);
      throw ApiError.duplicatePhoto(DUPLICATE_MESSAGE, outcome);
    }

    throw error;
  }
}

/** Audit trail of rejected duplicates, for the session's operator. */
async function listDuplicateAttempts(sessionId, user) {
  const session = await repo.findSessionByPublicId(sessionId);
  if (!session) throw ApiError.notFound('Capture session not found');
  if (user && session.created_by !== user.id && user.roleCode !== 'A') {
    throw ApiError.forbidden('This capture session belongs to another operator');
  }

  const rows = await repo.listDuplicateAttempts(sessionId);
  return rows.map((row) => ({
    imageId: row.image_id,
    sessionId: row.session_id,
    deviceId: row.device_id,
    deviceType: row.device_type,
    cameraType: row.camera_type,
    imageHash: row.content_hash,
    duplicateOf: row.duplicate_of,
    attemptedAt: row.captured_at,
  }));
}

module.exports = {
  DUPLICATE_MESSAGE,
  listDuplicateAttempts,
  createSession,
  getSessionState,
  closeSession,
  refreshJoinToken,
  joinSession,
  authenticateDevice,
  heartbeat,
  leaveSession,
  markDeviceDisconnected,
  submitCapture,
  requireActiveSession,
  toImageDto,
};
