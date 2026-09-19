'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('./ApiError');
const { CAPTURE_TOKEN_SCOPES } = require('./constants');

/**
 * Capture tokens are short-lived, single-purpose JWTs signed with the same
 * secret as the login token but carrying a `scope` claim that the normal
 * `authenticate` middleware never accepts - so a join/device/stream token can
 * never be used as a user session, and vice versa.
 */

function sign(scope, claims, ttlSeconds) {
  return jwt.sign({ ...claims, scope }, env.jwt.secret, { expiresIn: ttlSeconds });
}

function verify(token, expectedScope) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch (error) {
    throw ApiError.unauthorized(
      error.name === 'TokenExpiredError'
        ? 'This capture link has expired. Ask the operator for a new QR code.'
        : 'Invalid capture token',
    );
  }
  if (payload.scope !== expectedScope) {
    throw ApiError.forbidden('This token is not valid for that action');
  }
  return payload;
}

/** Encoded into the QR code. Lets any device holding it join `sessionId`. */
const signJoinToken = (sessionId, ttlSeconds) =>
  sign(CAPTURE_TOKEN_SCOPES.JOIN, { sid: sessionId }, ttlSeconds);

const verifyJoinToken = (token) => verify(token, CAPTURE_TOKEN_SCOPES.JOIN);

/** Issued once a device has joined; scoped to that one device. */
const signDeviceToken = (sessionId, deviceId, ttlSeconds) =>
  sign(CAPTURE_TOKEN_SCOPES.DEVICE, { sid: sessionId, did: deviceId }, ttlSeconds);

const verifyDeviceToken = (token) => verify(token, CAPTURE_TOKEN_SCOPES.DEVICE);

/** Issued to the desktop for the SSE stream (EventSource cannot send headers). */
const signStreamToken = (sessionId, userId, ttlSeconds) =>
  sign(CAPTURE_TOKEN_SCOPES.STREAM, { sid: sessionId, sub: userId }, ttlSeconds);

const verifyStreamToken = (token) => verify(token, CAPTURE_TOKEN_SCOPES.STREAM);

module.exports = {
  signJoinToken,
  verifyJoinToken,
  signDeviceToken,
  verifyDeviceToken,
  signStreamToken,
  verifyStreamToken,
};
