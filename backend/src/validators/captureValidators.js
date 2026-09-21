'use strict';

const { z } = require('zod');
const { DEVICE_TYPES, CAMERA_TYPES } = require('../utils/constants');

const sessionIdParam = z.object({
  sessionId: z.string().uuid('Invalid capture session id'),
});

const deviceType = z.enum(DEVICE_TYPES);
const cameraType = z.enum(CAMERA_TYPES);

const createSession = {
  body: z.object({
    purpose: z.string().max(50).optional(),
    maxDevices: z.coerce.number().int().min(1).max(10).optional(),
    duplicateScope: z.enum(['SESSION', 'GLOBAL']).optional(),
    ttlMinutes: z.coerce.number().int().min(5).max(180).optional(),
  }),
};

const sessionParams = { params: sessionIdParam };

/**
 * Joining takes the QR token and nothing else - the session is derived from the
 * signed token, so a client cannot ask to join a session it was not invited to.
 * `token` is the documented field name; `joinToken` is accepted as an alias so
 * the earlier client keeps working.
 */
const joinSession = {
  body: z
    .object({
      token: z.string().min(10).optional(),
      joinToken: z.string().min(10).optional(),
      deviceType: deviceType.optional(),
      cameraType: cameraType.optional(),
      deviceLabel: z.string().max(150).optional(),
    })
    .refine((value) => value.token || value.joinToken, {
      message: 'A connection token is required',
      path: ['token'],
    }),
};

const heartbeat = {
  body: z.object({
    cameraType: cameraType.optional(),
    deviceLabel: z.string().max(150).optional(),
  }),
};

/**
 * Duplicate detection is decided entirely on the server, from the decoded
 * pixels (see utils/imageHash.js).
 *
 * `perceptualHash`, `width` and `height` are still accepted so existing clients
 * keep working, but they are metadata only - the server recomputes all of them
 * and never lets a client-supplied value influence the verdict.
 */
const captureImage = {
  body: z.object({
    // Optional because a multipart request carries the bytes in the file part
    // instead; the controller rejects a request that has neither.
    image: z.string().min(1).optional(),
    perceptualHash: z
      .string()
      .regex(/^[0-9a-fA-F]{16}$/, 'Perceptual hash must be 16 hex characters')
      .optional(),
    sessionId: z.string().uuid('Invalid capture session id').optional(),
    deviceType: deviceType.optional(),
    cameraType: cameraType.optional(),
    width: z.coerce.number().int().positive().max(10000).optional(),
    height: z.coerce.number().int().positive().max(10000).optional(),
  }),
};

module.exports = {
  createSession,
  sessionParams,
  joinSession,
  heartbeat,
  captureImage,
};
