'use strict';

const { EventEmitter } = require('events');
const logger = require('../utils/logger');

/**
 * In-process pub/sub for capture sessions.
 *
 * Desktop clients subscribe over SSE; the capture service publishes device and
 * image events here and every subscriber on this process receives them.
 *
 * SCALING NOTE: this is deliberately in-memory, which means it only works when
 * a session's desktop subscriber and its mobile uploader are served by the same
 * Node process. To run more than one instance, replace `publish`/`subscribe`
 * with a Redis pub/sub channel per session (`capture:<sessionId>`) - the rest of
 * the code only talks to this module, so nothing else changes.
 */

const emitter = new EventEmitter();
// One SSE stream per desktop tab, several tabs per session is fine.
emitter.setMaxListeners(0);

/** Live subscriber counts, keyed by sessionId - used for connected/disconnected UI. */
const subscriberCounts = new Map();

const EVENTS = {
  DEVICE_JOINED: 'device.joined',
  DEVICE_LEFT: 'device.left',
  DEVICE_STATE: 'device.state',
  IMAGE_CAPTURED: 'image.captured',
  IMAGE_DUPLICATE: 'image.duplicate',
  CAPTURE_FAILED: 'capture.failed',
  SESSION_CLOSED: 'session.closed',
};

function channel(sessionId) {
  return `session:${sessionId}`;
}

/** Fan an event out to every subscriber of `sessionId`. */
function publish(sessionId, type, payload) {
  emitter.emit(channel(sessionId), { type, payload, at: new Date().toISOString() });
}

/** Returns an unsubscribe function. */
function subscribe(sessionId, listener) {
  const name = channel(sessionId);
  emitter.on(name, listener);
  subscriberCounts.set(sessionId, (subscriberCounts.get(sessionId) || 0) + 1);

  return function unsubscribe() {
    emitter.off(name, listener);
    const remaining = (subscriberCounts.get(sessionId) || 1) - 1;
    if (remaining <= 0) subscriberCounts.delete(sessionId);
    else subscriberCounts.set(sessionId, remaining);
  };
}

function subscriberCount(sessionId) {
  return subscriberCounts.get(sessionId) || 0;
}

/**
 * Attach an SSE stream for `sessionId` to `res`. Handles the handshake, a
 * heartbeat that keeps proxies from closing an idle connection, and cleanup
 * when the client goes away.
 */
function attachStream(req, res, sessionId, { heartbeatMs = 25000 } = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Nginx buffers proxied responses by default, which would hold events back
    // until the buffer fills - this opts the stream out.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (event) => {
    try {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      logger.error('Failed writing SSE frame', error.message);
    }
  };

  send({ type: 'stream.ready', payload: { sessionId }, at: new Date().toISOString() });

  const unsubscribe = subscribe(sessionId, send);
  // `: ` is an SSE comment - keeps the socket warm without firing client handlers.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), heartbeatMs);

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  };

  req.on('close', cleanup);
  req.on('error', cleanup);

  return cleanup;
}

module.exports = { EVENTS, publish, subscribe, subscriberCount, attachStream };
