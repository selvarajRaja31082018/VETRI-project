import { io, type Socket } from 'socket.io-client';

/**
 * Socket.IO client for capture sessions.
 *
 * Two roles connect to the same gateway, distinguished by the token handed to
 * the handshake:
 *
 *   desktop - a stream token; listens to everything happening in the session.
 *   device  - a device token; additionally emits `capture_started` the moment
 *             the shutter fires, which is what lets the desktop show a phone as
 *             "Capturing…" while its upload is still in flight.
 *
 * The server derives the session and device identity from the token, so nothing
 * here needs to (or may) assert which session it belongs to.
 */

/** Event names, matching the backend's `sessionBus.EVENTS`. */
export const CAPTURE_EVENTS = {
  DEVICE_CONNECTED: 'device_connected',
  DEVICE_DISCONNECTED: 'device_disconnected',
  DEVICE_STATE: 'device_state',
  CAPTURE_STARTED: 'capture_started',
  CAPTURE_SUCCESS: 'capture_success',
  CAPTURE_DUPLICATE: 'capture_duplicate',
  CAPTURE_FAILED: 'capture_failed',
  SESSION_CLOSED: 'session_closed',
} as const;

/**
 * The socket server runs on the API origin, not the app origin. `VITE_API_URL`
 * includes the `/api/v1` path prefix, which must be stripped - Socket.IO needs
 * the bare origin plus its own `path`.
 */
function socketOrigin(): string {
  const apiUrl = import.meta.env.VITE_API_URL;
  try {
    return new URL(apiUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

function connect(auth: Record<string, string>): Socket {
  return io(socketOrigin(), {
    path: '/socket.io',
    auth,
    // Polling fallback matters on restrictive networks where a WebSocket
    // upgrade is blocked; Socket.IO upgrades transparently when it can.
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 700,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });
}

/** Desktop subscriber: read-only view of one session. */
export function connectAsDesktop(streamToken: string): Socket {
  return connect({ streamToken });
}

/** Joined device: may announce that a capture has started. */
export function connectAsDevice(deviceToken: string): Socket {
  return connect({ deviceToken });
}

export const socketService = { connectAsDesktop, connectAsDevice, CAPTURE_EVENTS };
