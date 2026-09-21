'use strict';

const { Server } = require('socket.io');

const env = require('../config/env');
const logger = require('../utils/logger');
const bus = require('./sessionBus');
const captureToken = require('../utils/captureToken');
const captureService = require('../services/captureService');

/**
 * Socket.IO gateway for capture sessions.
 *
 * `sessionBus` stays the single place the domain publishes to; this module is
 * one transport on top of it (the SSE endpoint is the other). Anything the
 * service emits therefore reaches both kinds of subscriber with identical
 * event names and payloads.
 *
 * Two kinds of client connect, separated by the token they present in the
 * handshake:
 *
 *   desktop - a `capture:stream` token. Read-only: it joins the session room
 *             and listens. It may not emit anything into the room.
 *   device  - a `capture:device` token. May emit `capture_started` so the
 *             desktop can show "Capturing…" while the upload is in flight.
 *
 * A client that presents neither is refused at the handshake. Nothing trusts a
 * sessionId or deviceId sent in the payload - both come from the signed token.
 */

const room = (sessionId) => `session:${sessionId}`;

/** Sessions this process has already wired to the bus, so we subscribe once. */
const bridged = new Map();

let io = null;

function bridgeSession(sessionId) {
  if (bridged.has(sessionId)) return;

  const unsubscribe = bus.subscribe(sessionId, (event) => {
    io.to(room(sessionId)).emit(event.type, { ...event.payload, at: event.at });
    // Also emit a single envelope channel, so a client can log or handle every
    // event generically without registering each name.
    io.to(room(sessionId)).emit('capture_event', event);
  });

  bridged.set(sessionId, unsubscribe);
}

/** Drop the bus subscription once the last socket for a session has gone. */
async function releaseSessionIfEmpty(sessionId) {
  const sockets = await io.in(room(sessionId)).fetchSockets();
  if (sockets.length > 0) return;

  const unsubscribe = bridged.get(sessionId);
  if (unsubscribe) {
    unsubscribe();
    bridged.delete(sessionId);
  }
}

/** Resolve the handshake credentials into a session + role, or throw. */
async function authenticate(handshake) {
  const auth = handshake.auth || {};
  const query = handshake.query || {};
  const streamToken = auth.streamToken || query.streamToken;
  const deviceToken = auth.deviceToken || query.deviceToken;

  if (streamToken) {
    const payload = captureToken.verifyStreamToken(String(streamToken));
    // Confirms the session still exists and is open.
    await captureService.requireActiveSession(payload.sid);
    return { role: 'desktop', sessionId: payload.sid, userId: payload.sub, deviceId: null };
  }

  if (deviceToken) {
    const { device, session } = await captureService.authenticateDevice(String(deviceToken));
    return { role: 'device', sessionId: session.session_id, deviceId: device.device_id, userId: null };
  }

  const error = new Error('A capture stream or device token is required');
  error.data = { code: 'UNAUTHENTICATED' };
  throw error;
}

function attach(httpServer) {
  io = new Server(httpServer, {
    path: '/socket.io',
    // Mobile devices connect from PUBLIC_APP_URL, a different origin.
    cors: { origin: env.corsOrigins, credentials: true },
    // Long-poll fallback matters here: hotel/venue wifi often blocks upgrades.
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      socket.data.capture = await authenticate(socket.handshake);
      next();
    } catch (error) {
      logger.warn('Rejected socket handshake:', error.message);
      next(error);
    }
  });

  io.on('connection', (socket) => {
    const { role, sessionId, deviceId } = socket.data.capture;

    socket.join(room(sessionId));
    bridgeSession(sessionId);
    logger.info(`Socket ${role} joined session ${sessionId}${deviceId ? ` as device ${deviceId}` : ''}`);

    socket.emit('connection_ready', { sessionId, role, deviceId });

    /*
     * The shutter has fired on a device; the upload is about to start. This is
     * the one message that travels upstream, and the only reason this feature
     * needs a bidirectional transport rather than server-sent events alone.
     * The deviceId comes from the socket's token, never from the payload.
     */
    socket.on('capture_started', () => {
      if (role !== 'device') return;
      bus.publish(sessionId, bus.EVENTS.CAPTURE_STARTED, { sessionId, deviceId });
    });

    socket.on('disconnect', async (reason) => {
      // A phone closing its tab or losing signal is a real disconnect, so the
      // desktop is told immediately rather than waiting for heartbeat reaping.
      if (role === 'device') {
        try {
          await captureService.markDeviceDisconnected(sessionId, deviceId);
        } catch (error) {
          logger.warn(`Could not mark device ${deviceId} disconnected:`, error.message);
        }
      }
      logger.info(`Socket ${role} left session ${sessionId} (${reason})`);
      try {
        await releaseSessionIfEmpty(sessionId);
      } catch {
        /* the server is shutting down - nothing to release */
      }
    });
  });

  return io;
}

/** Close every socket; used on graceful shutdown. */
async function close() {
  if (!io) return;
  for (const unsubscribe of bridged.values()) unsubscribe();
  bridged.clear();
  await io.close();
  io = null;
}

module.exports = { attach, close };
