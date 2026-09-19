import { useCallback, useEffect, useRef, useState } from 'react';
import { captureService } from '../services/captureService';
import { getErrorMessage } from '../utils/errors';
import type {
  CaptureDevice,
  CaptureEvent,
  CaptureSessionCreated,
  CapturedImage,
  DuplicateEventPayload,
} from '../types';

export type SessionConnection = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'CLOSED' | 'ERROR';

interface UseCaptureSessionOptions {
  /** Open a session as soon as the hook mounts (the desktop registration flow). */
  autoStart?: boolean;
  onImage?: (image: CapturedImage) => void;
  onDuplicate?: (payload: DuplicateEventPayload) => void;
}

/**
 * Desktop side of a capture session: opens the session, keeps a live SSE
 * subscription to it, and maintains the connected-device and captured-image
 * lists that the operator sees.
 *
 * Everything here degrades quietly. If the session cannot be opened (offline,
 * server down, permission missing) `sessionId` stays null and the caller falls
 * back to the single-device upload path, so the existing desktop webcam flow
 * keeps working exactly as before.
 */
export function useCaptureSession({ autoStart = false, onImage, onDuplicate }: UseCaptureSessionOptions = {}) {
  const [session, setSession] = useState<CaptureSessionCreated | null>(null);
  const [devices, setDevices] = useState<CaptureDevice[]>([]);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [connection, setConnection] = useState<SessionConnection>('IDLE');
  const [error, setError] = useState<string | null>(null);

  const sourceRef = useRef<EventSource | null>(null);
  const startedRef = useRef(false);
  // Held in refs so the SSE effect does not re-subscribe every time the parent
  // re-renders with new callback identities. Kept up to date in an effect
  // rather than during render, so a discarded render never mutates them.
  const onImageRef = useRef(onImage);
  const onDuplicateRef = useRef(onDuplicate);
  useEffect(() => {
    onImageRef.current = onImage;
    onDuplicateRef.current = onDuplicate;
  }, [onImage, onDuplicate]);

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

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

  /** Subscribe to the session's event stream and mirror events into local state. */
  useEffect(() => {
    if (!session) return;

    const source = new EventSource(captureService.eventStreamUrl(session.sessionId, session.streamToken));
    sourceRef.current = source;

    const handle = <T,>(type: string, handler: (payload: T) => void) => {
      source.addEventListener(type, (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent).data) as CaptureEvent<T>;
          handler(parsed.payload);
        } catch {
          /* a malformed frame must not tear down the stream */
        }
      });
    };

    source.addEventListener('stream.ready', () => {
      setConnection('CONNECTED');
      setError(null);
    });

    handle<CaptureDevice>('device.joined', (device) => {
      setDevices((current) => [...current.filter((d) => d.deviceId !== device.deviceId), device]);
    });

    handle<{ deviceId: string }>('device.left', ({ deviceId }) => {
      setDevices((current) =>
        current.map((d) => (d.deviceId === deviceId ? { ...d, status: 'DISCONNECTED' } : d)),
      );
    });

    handle<{ deviceId: string; status: CaptureDevice['status']; cameraType?: CaptureDevice['cameraType'] }>(
      'device.state',
      ({ deviceId, status, cameraType }) => {
        setDevices((current) =>
          current.map((d) =>
            d.deviceId === deviceId ? { ...d, status, cameraType: cameraType || d.cameraType } : d,
          ),
        );
      },
    );

    handle<CapturedImage>('image.captured', (image) => {
      // Guard against a duplicate render if the uploading tab is also subscribed.
      setImages((current) =>
        current.some((i) => i.imageId === image.imageId) ? current : [...current, image],
      );
      onImageRef.current?.(image);
    });

    handle<DuplicateEventPayload>('image.duplicate', (payload) => {
      onDuplicateRef.current?.(payload);
    });

    handle<{ reason: string }>('session.closed', () => {
      setConnection('CLOSED');
      closeStream();
    });

    source.onerror = () => {
      // EventSource reconnects on its own; surface the gap without tearing the
      // stream down, so a brief network blip recovers silently.
      setConnection((current) => (current === 'CLOSED' ? current : 'RECONNECTING'));
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [session, closeStream]);

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
      setSession((current) => (current ? { ...current, joinUrl: refreshed.joinUrl, joinExpiresAt: refreshed.joinExpiresAt } : current));
      return refreshed;
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    }
  }, [session]);

  const close = useCallback(async () => {
    if (!session) return;
    closeStream();
    try {
      await captureService.closeSession(session.sessionId);
    } catch {
      /* the session expires on its own; a failed close is not worth blocking on */
    }
    setConnection('CLOSED');
    setSession(null);
  }, [session, closeStream]);

  useEffect(() => closeStream, [closeStream]);

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
