import axios from 'axios';
import { api, ApiClientError } from './api';
import type {
  ApiSuccess,
  CameraType,
  CaptureDeviceJoined,
  CaptureSessionCreated,
  CaptureSessionState,
  CapturedImage,
  DeviceType,
  DuplicateAttempt,
} from '../types';

/**
 * Client for the multi-device capture API.
 *
 * Two credential kinds live here. Desktop calls ride the normal `api` instance
 * (user session, bearer token added by the interceptor). A device that joined
 * by scanning a QR code has no user session at all - it holds a device token,
 * so those calls go through `deviceApi`, a separate axios instance that does
 * *not* pick up the operator's token.
 */

const DEVICE_TOKEN_KEY = 'vetri.capture.deviceToken';

export interface CapturePayload {
  image: string;
  perceptualHash?: string | null;
  width?: number;
  height?: number;
  deviceType?: DeviceType;
  cameraType?: CameraType;
}

/* ----------------------------------------------------------------- desktop */

async function createSession(options: { purpose?: string; maxDevices?: number; ttlMinutes?: number } = {}) {
  const { data } = await api.post<ApiSuccess<CaptureSessionCreated>>('/capture/sessions', options);
  return data.data;
}

async function getSessionState(sessionId: string) {
  const { data } = await api.get<ApiSuccess<CaptureSessionState>>(`/capture/sessions/${sessionId}`);
  return data.data;
}

async function refreshJoinToken(sessionId: string) {
  const { data } = await api.post<ApiSuccess<{ sessionId: string; joinUrl: string; joinExpiresAt: string }>>(
    `/capture/sessions/${sessionId}/refresh-qr`,
  );
  return data.data;
}

async function closeSession(sessionId: string) {
  await api.delete(`/capture/sessions/${sessionId}`);
}

/** Desktop/USB capture. `sessionId` is optional - without it the photo is still
 *  stored and duplicate-checked, just not attached to a shared session. */
async function captureFromDesktop(payload: CapturePayload & { sessionId?: string | null }) {
  const { data } = await api.post<ApiSuccess<CapturedImage>>('/capture/images', {
    ...payload,
    perceptualHash: payload.perceptualHash || undefined,
    sessionId: payload.sessionId || undefined,
  });
  return data.data;
}

/** SSE URL for a session. The token goes in the query string because
 *  `EventSource` cannot set an Authorization header. */
function eventStreamUrl(sessionId: string, streamToken: string) {
  const base = import.meta.env.VITE_API_URL;
  return `${base}/capture/sessions/${sessionId}/events?token=${encodeURIComponent(streamToken)}`;
}

/* ------------------------------------------------------------ joined device */

const deviceApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 20000,
});

export function getDeviceToken(): string | null {
  return sessionStorage.getItem(DEVICE_TOKEN_KEY);
}

/**
 * Stored in `sessionStorage`, not `localStorage`: the token is scoped to one
 * capture session, and a shared kiosk phone should not carry it into the next
 * browser session.
 */
export function setDeviceToken(token: string | null): void {
  if (token) sessionStorage.setItem(DEVICE_TOKEN_KEY, token);
  else sessionStorage.removeItem(DEVICE_TOKEN_KEY);
}

deviceApi.interceptors.request.use((config) => {
  const token = getDeviceToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Mirror the main client's error normalisation so components can use
// getErrorMessage()/ApiClientError uniformly.
deviceApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const data = error.response.data;
      const body = data?.error;
      // Duplicate rejections also carry code/message at the top level.
      return Promise.reject(
        new ApiClientError(
          error.response.status,
          body?.code || data?.code || 'UNKNOWN_ERROR',
          body?.message || data?.message || 'Something went wrong. Please try again.',
          body?.details || [],
        ),
      );
    }
    if (error.request) {
      return Promise.reject(
        new ApiClientError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.'),
      );
    }
    return Promise.reject(new ApiClientError(0, 'UNKNOWN_ERROR', error.message));
  },
);

/**
 * Exchange the QR token for a device identity + device token.
 *
 * Only the token is sent: the server derives which session this is from the
 * signature, so the page never needs to know (or be able to choose) a session id.
 */
async function joinSession(
  token: string,
  deviceInfo: { deviceType: DeviceType; cameraType: CameraType; deviceLabel?: string },
) {
  const { data } = await deviceApi.post<ApiSuccess<CaptureDeviceJoined>>('/capture/sessions/join', {
    token,
    ...deviceInfo,
  });
  setDeviceToken(data.data.deviceToken);
  return data.data;
}

async function getDeviceSession() {
  const { data } = await deviceApi.get<ApiSuccess<unknown>>('/capture/devices/me');
  return data.data;
}

async function heartbeat(patch: { cameraType?: CameraType; deviceLabel?: string } = {}) {
  await deviceApi.post('/capture/devices/me/heartbeat', patch);
}

async function captureFromDevice(payload: CapturePayload) {
  const { data } = await deviceApi.post<ApiSuccess<CapturedImage>>('/capture/devices/me/images', {
    ...payload,
    perceptualHash: payload.perceptualHash || undefined,
  });
  return data.data;
}

async function leaveSession() {
  try {
    await deviceApi.delete('/capture/devices/me');
  } finally {
    setDeviceToken(null);
  }
}

/** Audit trail of duplicates rejected in this session. */
async function listDuplicateAttempts(sessionId: string) {
  const { data } = await api.get<ApiSuccess<{ attempts: DuplicateAttempt[] }>>(
    `/capture/sessions/${sessionId}/duplicates`,
  );
  return data.data.attempts;
}

export const captureService = {
  listDuplicateAttempts,
  createSession,
  getSessionState,
  refreshJoinToken,
  closeSession,
  captureFromDesktop,
  eventStreamUrl,
  joinSession,
  getDeviceSession,
  heartbeat,
  captureFromDevice,
  leaveSession,
};
