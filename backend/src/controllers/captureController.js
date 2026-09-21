'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { success, created } = require('../utils/response');
const { writeAudit, auditContext } = require('../utils/audit');
const captureService = require('../services/captureService');
const bus = require('../realtime/sessionBus');

/** Public base URL the stored photo will be served from. */
const publicBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;

const clientContext = (req) => ({
  userAgent: req.headers['user-agent'] || null,
  ipAddress: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
});

/* ------------------------------------------------------------------ sessions */

const createSession = asyncHandler(async (req, res) => {
  const session = await captureService.createSession(req.user, req.body);

  await writeAudit(null, auditContext(req), {
    action: 'CAPTURE_SESSION_OPENED',
    entityType: 'capture_session',
    newValue: { sessionId: session.sessionId, expiresAt: session.expiresAt },
  });

  created(res, session, 'Capture session created');
});

const getSession = asyncHandler(async (req, res) => {
  const state = await captureService.getSessionState(req.params.sessionId, req.user);
  success(res, { ...state, subscribers: bus.subscriberCount(req.params.sessionId) });
});

const closeSession = asyncHandler(async (req, res) => {
  const result = await captureService.closeSession(req.params.sessionId, req.user);

  await writeAudit(null, auditContext(req), {
    action: 'CAPTURE_SESSION_CLOSED',
    entityType: 'capture_session',
    newValue: { sessionId: result.sessionId },
  });

  success(res, result, 'Capture session closed');
});

const refreshJoinToken = asyncHandler(async (req, res) => {
  const result = await captureService.refreshJoinToken(req.params.sessionId, req.user);
  success(res, result, 'QR code refreshed');
});

/** Long-lived SSE connection - never call success()/next() on the happy path. */
const streamSession = asyncHandler(async (req, res) => {
  await captureService.requireActiveSession(req.params.sessionId);
  bus.attachStream(req, res, req.params.sessionId);
});

/* ------------------------------------------------------------------- devices */

const joinSession = asyncHandler(async (req, res) => {
  const { token, joinToken, ...deviceInfo } = req.body;
  const result = await captureService.joinSession(token || joinToken, deviceInfo, clientContext(req));

  await writeAudit(null, { ...clientContext(req), userId: null }, {
    action: 'CAPTURE_DEVICE_JOINED',
    entityType: 'capture_device',
    newValue: {
      sessionId: result.sessionId,
      deviceId: result.device.deviceId,
      deviceType: result.device.deviceType,
    },
  });

  created(res, result, 'Device connected to capture session');
});

const heartbeat = asyncHandler(async (req, res) => {
  const result = await captureService.heartbeat(req.captureDevice, req.captureSession, req.body);
  success(res, result);
});

const leaveSession = asyncHandler(async (req, res) => {
  const result = await captureService.leaveSession(req.captureDevice, req.captureSession);
  success(res, result, 'Device disconnected');
});

/** What a joined device is allowed to know about the session it is serving. */
const getDeviceSession = asyncHandler(async (req, res) => {
  success(res, {
    sessionId: req.captureSession.session_id,
    status: req.captureSession.status,
    expiresAt: req.captureSession.expires_at,
    device: {
      deviceId: req.captureDevice.device_id,
      deviceType: req.captureDevice.device_type,
      cameraType: req.captureDevice.camera_type,
      status: req.captureDevice.status,
    },
  });
});

/* -------------------------------------------------------------------- images */

/** Upload from a joined device (mobile / USB station). */
const captureFromDevice = asyncHandler(async (req, res) => {
  const image = await captureService.submitCapture(
    { kind: 'device', device: req.captureDevice, session: req.captureSession },
    { ...req.body, file: req.file, publicBaseUrl: publicBaseUrl(req) },
  );
  created(res, image, 'Photo captured');
});

/**
 * Upload from the signed-in desktop. Same pipeline, same duplicate rules - the
 * only difference is which credential proved who is uploading.
 */
const captureFromDesktop = asyncHandler(async (req, res) => {
  let session = null;
  if (req.body.sessionId) {
    session = await captureService.requireActiveSession(req.body.sessionId);
    // A device token is bound to its session; a user token is not, so the
    // operator's claim on this session has to be checked explicitly.
    if (session.created_by !== req.user.id && req.user.roleCode !== 'A') {
      throw ApiError.forbidden('This capture session belongs to another operator');
    }
  }

  const image = await captureService.submitCapture(
    { kind: 'user', user: req.user, session },
    { ...req.body, file: req.file, publicBaseUrl: publicBaseUrl(req) },
  );

  await writeAudit(null, auditContext(req), {
    action: 'PHOTO_CAPTURED',
    entityType: 'captured_image',
    newValue: { imageId: image.imageId, sessionId: image.sessionId, cameraType: image.cameraType },
  });

  created(res, image, 'Photo captured');
});

/** Audit trail of rejected duplicates for a session. */
const listDuplicateAttempts = asyncHandler(async (req, res) => {
  const attempts = await captureService.listDuplicateAttempts(req.params.sessionId, req.user);
  success(res, { attempts });
});

module.exports = {
  listDuplicateAttempts,
  createSession,
  getSession,
  closeSession,
  refreshJoinToken,
  streamSession,
  joinSession,
  heartbeat,
  leaveSession,
  getDeviceSession,
  captureFromDevice,
  captureFromDesktop,
};
