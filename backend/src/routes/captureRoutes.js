'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const controller = require('../controllers/captureController');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { authenticateDevice, authenticateStream } = require('../middleware/captureAuth');
const validators = require('../validators/captureValidators');
const { PERMISSIONS } = require('../utils/constants');

const router = Router();

/**
 * Captures may arrive as multipart/form-data (the documented form) or as a
 * base64 data URL in JSON (what the browser canvas produces directly). Files
 * are held in memory: they are hashed and duplicate-checked before anything is
 * written, so spooling a rejected photo to disk first would be wasted work.
 *
 * The MIME type is re-derived from the bytes downstream; this filter is only a
 * cheap first pass, and the client's filename is never used.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

/** Accept a single `image` part, but only when the request is multipart. */
const maybeMultipart = (req, res, next) =>
  (req.is('multipart/form-data') ? upload.single('image') : (_q, _s, done) => done())(req, res, next);

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
  maybeMultipart,
  validate(validators.captureImage),
  controller.captureFromDesktop,
);

// Audit trail of rejected duplicates for a session.
router.get(
  '/sessions/:sessionId/duplicates',
  authenticate,
  validate(validators.sessionParams),
  controller.listDuplicateAttempts,
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

/**
 * A scanned device joins using only the token from the QR code - the session is
 * derived from the signed token server-side.
 */
router.post('/sessions/join', joinLimiter, validate(validators.joinSession), controller.joinSession);

// Earlier path that named the session explicitly. Kept so an already-open QR
// code keeps working; the session still comes from the token, not the URL.
router.post('/sessions/:sessionId/devices', joinLimiter, validate(validators.joinSession), controller.joinSession);

router.get('/devices/me', authenticateDevice, controller.getDeviceSession);

router.post('/devices/me/heartbeat', authenticateDevice, validate(validators.heartbeat), controller.heartbeat);

router.delete('/devices/me', authenticateDevice, controller.leaveSession);

router.post(
  '/devices/me/images',
  authenticateDevice,
  captureLimiter,
  maybeMultipart,
  validate(validators.captureImage),
  controller.captureFromDevice,
);

module.exports = router;
