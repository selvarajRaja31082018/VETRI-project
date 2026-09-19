'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const controller = require('../controllers/captureController');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { authenticateDevice, authenticateStream } = require('../middleware/captureAuth');
const validators = require('../validators/captureValidators');
const { PERMISSIONS } = require('../utils/constants');

const router = Router();

/**
 * The join endpoint is the only unauthenticated surface here: it is reachable
 * by anyone holding a valid, short-lived QR token. Rate-limit it per IP so a
 * leaked QR image cannot be used to enumerate or flood a session.
 */
const joinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many join attempts. Try again shortly.', details: [] } },
});

/** Uploads are the expensive path; cap them per device/IP. */
const captureLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many captures. Slow down and try again.', details: [] } },
});

/* ------------------------------------------- desktop operator (user session) */

router.post(
  '/sessions',
  authenticate,
  requirePermission(PERMISSIONS.VISITOR_CREATE),
  validate(validators.createSession),
  controller.createSession,
);

router.get('/sessions/:sessionId', authenticate, validate(validators.sessionParams), controller.getSession);

router.post(
  '/sessions/:sessionId/refresh-qr',
  authenticate,
  requirePermission(PERMISSIONS.VISITOR_CREATE),
  validate(validators.sessionParams),
  controller.refreshJoinToken,
);

router.delete('/sessions/:sessionId', authenticate, validate(validators.sessionParams), controller.closeSession);

// Desktop capture: the same pipeline as mobile, authorised by the user session.
router.post(
  '/images',
  authenticate,
  requirePermission(PERMISSIONS.VISITOR_CREATE),
  captureLimiter,
  validate(validators.captureImage),
  controller.captureFromDesktop,
);

/* -------------------------------------------------- real-time (stream token) */

// EventSource cannot send an Authorization header, so this one authorises from
// a scoped `?token=` instead of the user session.
router.get(
  '/sessions/:sessionId/events',
  validate(validators.sessionParams),
  authenticateStream,
  controller.streamSession,
);

/* ----------------------------------------------- joined devices (QR / mobile) */

router.post(
  '/sessions/:sessionId/devices',
  joinLimiter,
  validate(validators.joinSession),
  controller.joinSession,
);

router.get('/devices/me', authenticateDevice, controller.getDeviceSession);

router.post('/devices/me/heartbeat', authenticateDevice, validate(validators.heartbeat), controller.heartbeat);

router.delete('/devices/me', authenticateDevice, controller.leaveSession);

router.post(
  '/devices/me/images',
  authenticateDevice,
  captureLimiter,
  validate(validators.captureImage),
  controller.captureFromDevice,
);

module.exports = router;
