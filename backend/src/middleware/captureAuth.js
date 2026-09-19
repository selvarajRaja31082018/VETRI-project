'use strict';

const ApiError = require('../utils/ApiError');
const captureService = require('../services/captureService');
const captureToken = require('../utils/captureToken');

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

/**
 * Authenticates a joined capture device (a scanned phone or USB station) from
 * its `capture:device` token. Deliberately separate from `authenticate`: a
 * device has no user account, no role and no permissions - it may only act on
 * the one session it joined.
 */
async function authenticateDevice(req, res, next) {
  try {
    const token = bearer(req) || req.body?.deviceToken;
    if (!token) throw ApiError.unauthorized('Missing device token');

    const { device, session } = await captureService.authenticateDevice(token);
    req.captureDevice = device;
    req.captureSession = session;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Authorises an SSE subscription. EventSource cannot set headers, so the
 * stream token arrives as a query parameter; it is scoped to one session and
 * read-only, which is why it is safe to put in a URL.
 */
async function authenticateStream(req, res, next) {
  try {
    const token = req.query.token || bearer(req);
    if (!token) throw ApiError.unauthorized('Missing stream token');

    const payload = captureToken.verifyStreamToken(String(token));
    if (payload.sid !== req.params.sessionId) {
      throw ApiError.forbidden('This token is not valid for that session');
    }
    req.captureStream = { sessionId: payload.sid, userId: payload.sub };
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticateDevice, authenticateStream };
