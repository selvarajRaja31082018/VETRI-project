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

const joinSession = {
  params: sessionIdParam,
  body: z.object({
    joinToken: z.string().min(10, 'Join token is required'),
    deviceType: deviceType.optional(),
    cameraType: cameraType.optional(),
    deviceLabel: z.string().max(150).optional(),
  }),
};

const heartbeat = {
  body: z.object({
    cameraType: cameraType.optional(),
    deviceLabel: z.string().max(150).optional(),
  }),
};

/**
 * `perceptualHash` is the 64-bit dHash the browser computed from the same
 * canvas frame it encoded; optional so a client that cannot compute one still
 * gets the exact-match duplicate check.
 */
const captureImage = {
  body: z.object({
    image: z.string().min(1, 'Image data is required'),
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
