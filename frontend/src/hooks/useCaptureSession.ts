import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { captureService } from '../services/captureService';
import { connectAsDesktop, CAPTURE_EVENTS } from '../services/socketService';
import { getErrorMessage } from '../utils/errors';
import type {
  CaptureDevice,
  CaptureSessionCreated,
  CapturedImage,
  DuplicateEventPayload,
} from '../types';

export type SessionConnection = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'CLOSED' | 'ERROR';

/** A device the desktop is tracking, plus whether it is mid-capture. */
export interface TrackedDevice extends CaptureDevice {
  isCapturing?: boolean;
}

interface UseCaptureSessionOptions {
  /** Open a session as soon as the hook mounts (the desktop registration flow). */
  autoStart?: boolean;
  onImage?: (image: CapturedImage) => void;
  onDuplicate?: (payload: DuplicateEventPayload) => void;
}

/**
 * Desktop side of a capture session: opens the session, holds the Socket.IO
 * subscription to it, and maintains the connected-device and received-photo
 * lists the operator sees.
 *
 * Everything degrades quietly. If the session cannot be opened (offline, server
 * down, permission missing) `sessionId` stays null and the caller falls back to
 * the single-device upload path, so the existing desktop webcam flow keeps
 * working exactly as before.
 */
export function useCaptureSession({ autoStart = false, onImage, onDuplicate }: UseCaptureSessionOptions = {}) {
  const [session, setSession] = useState<CaptureSessionCreated | null>(null);
  const [devices, setDevices] = useState<TrackedDevice[]>([]);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [connection, setConnection] = useState<SessionConnection>('IDLE');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const startedRef = useRef(false);
  // Held in refs so the socket effect does not re-subscribe every time the
  // parent re-renders with new callback identities.
  const onImageRef = useRef(onImage);
  const onDuplicateRef = useRef(onDuplicate);
  useEffect(() => {
    onImageRef.current = onImage;
    onDuplicateRef.current = onDuplicate;
  }, [onImage, onDuplicate]);

  const start = useCallback(async () => {
    setError(null);
    setConnection('CONNECTING');
    try {
      const created = await captureService.createSession({ purpose: 'VISITOR_REGISTRATION' });
      setSession(created);
      return created;
    } catch (err) {
      setConnection('ERROR');
      setError(getErrorMessage(err));
      return null;
    }
  }, []);

  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [autoStart, start]);

  /** Subscribe to the session's events and mirror them into local state. */
  useEffect(() => {
    if (!session) return;

    const socket = connectAsDesktop(session.streamToken);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnection('CONNECTED');
      setError(null);
    });

    // Socket.IO retries on its own; surface the gap without tearing down.
    socket.on('disconnect', () => {
      setConnection((current) => (current === 'CLOSED' ? current : 'RECONNECTING'));
    });

    socket.on('connect_error', (err: Error) => {
      setConnection((current) => (current === 'CLOSED' ? current : 'RECONNECTING'));
      setError(err.message);
    });

    socket.on(CAPTURE_EVENTS.DEVICE_CONNECTED, (device: CaptureDevice) => {
      setDevices((current) => [...current.filter((d) => d.deviceId !== device.deviceId), device]);
    });

    socket.on(CAPTURE_EVENTS.DEVICE_DISCONNECTED, ({ deviceId }: { deviceId: string }) => {
      setDevices((current) =>
        current.map((d) =>
          d.deviceId === deviceId ? { ...d, status: 'DISCONNECTED', isCapturing: false } : d,
        ),
      );
    });

    socket.on(
      CAPTURE_EVENTS.DEVICE_STATE,
      ({ deviceId, status, cameraType }: { deviceId: string; status: CaptureDevice['status']; cameraType?: CaptureDevice['cameraType'] }) => {
        setDevices((current) =>
          current.map((d) =>
            d.deviceId === deviceId ? { ...d, status, cameraType: cameraType || d.cameraType } : d,
          ),
        );
      },
    );

    // The shutter fired on a phone; show it as "Capturing" until the upload
    // resolves one way or the other.
    socket.on(CAPTURE_EVENTS.CAPTURE_STARTED, ({ deviceId }: { deviceId: string }) => {
      setDevices((current) =>
        current.map((d) => (d.deviceId === deviceId ? { ...d, isCapturing: true } : d)),
      );
    });

    const clearCapturing = (deviceId: string | null) => {
      if (!deviceId) return;
      setDevices((current) =>
        current.map((d) => (d.deviceId === deviceId ? { ...d, isCapturing: false } : d)),
      );
    };

    socket.on(CAPTURE_EVENTS.CAPTURE_SUCCESS, (image: CapturedImage) => {
      clearCapturing(image.deviceId);
      // Guard against a double render if this tab also performed the upload.
      setImages((current) =>
        current.some((i) => i.imageId === image.imageId) ? current : [...current, image],
      );
      onImageRef.current?.(image);
    });

    // A duplicate is never added to the received list - the server stored
    // nothing - so it only clears the capturing flag and raises the notice.
    socket.on(CAPTURE_EVENTS.CAPTURE_DUPLICATE, (payload: DuplicateEventPayload) => {
      clearCapturing(payload.deviceId);
      onDuplicateRef.current?.(payload);
    });

    socket.on(CAPTURE_EVENTS.CAPTURE_FAILED, ({ deviceId }: { deviceId: string | null }) => {
      clearCapturing(deviceId);
    });

    socket.on(CAPTURE_EVENTS.SESSION_CLOSED, () => {
      setConnection('CLOSED');
      socket.disconnect();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session]);

  /** Pull the authoritative snapshot - used after a reload or a long stall. */
  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const state = await captureService.getSessionState(session.sessionId);
      setDevices(state.devices);
      setImages(state.images);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [session]);

  const refreshQr = useCallback(async () => {
    if (!session) return null;
    try {
      const refreshed = await captureService.refreshJoinToken(session.sessionId);
      setSession((current) =>
        current
          ? { ...current, joinUrl: refreshed.joinUrl, joinExpiresAt: refreshed.joinExpiresAt }
          : current,
      );
      return refreshed;
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    }
  }, [session]);

  const close = useCallback(async () => {
    if (!session) return;
    socketRef.current?.disconnect();
    socketRef.current = null;
    try {
      await captureService.closeSession(session.sessionId);
    } catch {
      /* the session expires on its own; a failed close is not worth blocking on */
    }
    setConnection('CLOSED');
    setSession(null);
  }, [session]);

  const connectedDevices = devices.filter((device) => device.status === 'CONNECTED');

  return {
    session,
    sessionId: session?.sessionId ?? null,
    devices,
    connectedDevices,
    images,
    connection,
    error,
    start,
    refresh,
    refreshQr,
    close,
  };
}
