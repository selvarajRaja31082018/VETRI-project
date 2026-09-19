import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { describeCameraError } from '../../utils/cameraErrors';
import { captureService } from '../../services/captureService';
import { ApiClientError } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { computePerceptualHash } from '../../utils/imageHash';
import { classifyCameraFromStream, describeDevice, detectDeviceType } from '../../utils/deviceInfo';
import type { CameraType, CaptureStatus } from '../../types';
import './MobileCapturePage.css';

const HEARTBEAT_MS = 15_000;

const STATUS_COPY: Record<CaptureStatus, { label: string; tone: string }> = {
  IDLE: { label: 'Not connected', tone: 'neutral' },
  CONNECTING: { label: 'Connecting…', tone: 'info' },
  CONNECTED: { label: 'Connected', tone: 'success' },
  DISCONNECTED: { label: 'Disconnected', tone: 'danger' },
  CAPTURING: { label: 'Capturing…', tone: 'info' },
  UPLOADING: { label: 'Sending…', tone: 'info' },
  DUPLICATE: { label: 'Duplicate photo', tone: 'warning' },
  SUCCESS: { label: 'Photo sent', tone: 'success' },
  ERROR: { label: 'Error', tone: 'danger' },
};

/**
 * The page a phone lands on after scanning the desktop's QR code.
 *
 * Deliberately public and unauthenticated: the operator's login never touches
 * the phone. Authority comes entirely from the short-lived join token in the
 * URL, which is exchanged once for a device token scoped to this one session.
 *
 * The capture mechanics (canvas frame, dHash, duplicate handling) are the same
 * as the desktop's CameraCapture; only the transport and the full-bleed layout
 * differ, so a phone screen can be used one-handed.
 */
export function MobileCapturePage() {
  const { sessionId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const joinToken = searchParams.get('t') || '';

  // A malformed link is knowable at first render, so it is the initial state
  // rather than something an effect corrects a moment later.
  const linkIsComplete = Boolean(sessionId && joinToken);
  const [status, setStatus] = useState<CaptureStatus>(linkIsComplete ? 'CONNECTING' : 'ERROR');
  const [message, setMessage] = useState<string | null>(
    linkIsComplete ? null : 'This capture link is incomplete. Scan the QR code on the desktop again.',
  );
  const [sentCount, setSentCount] = useState(0);
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  const [cameraType, setCameraType] = useState<CameraType>('UNKNOWN');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const joinedRef = useRef(false);
  const [deviceType] = useState(detectDeviceType);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  /** Open the camera. Separate from joining so a permission denial can be
   *  retried without re-consuming the join token. */
  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) throw new Error('Video element is not ready');

        video.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Failed to load camera stream'));
        });
        await video.play();

        const detected = classifyCameraFromStream(deviceType, stream);
        setCameraType(detected);
        setStatus('CONNECTED');
        setMessage(null);
        // Tell the desktop which camera this phone ended up using.
        void captureService.heartbeat({ cameraType: detected }).catch(() => undefined);
      } catch (err) {
        setStatus('ERROR');
        setMessage(describeCameraError(err));
      }
    },
    [deviceType, stopStream],
  );

  /** Join the session once, then open the camera. */
  useEffect(() => {
    if (joinedRef.current || !linkIsComplete) return;
    joinedRef.current = true;

    (async () => {
      try {
        const joined = await captureService.joinSession(sessionId, joinToken, {
          deviceType,
          cameraType: 'UNKNOWN',
          deviceLabel: describeDevice(deviceType),
        });
        setCameraType(joined.device.cameraType);
        await startCamera('environment');
      } catch (err) {
        setStatus('ERROR');
        setMessage(getErrorMessage(err));
      }
    })();
  }, [sessionId, joinToken, deviceType, startCamera, linkIsComplete]);

  /** Heartbeat so the desktop can show this phone as connected, and so a
   *  dropped network surfaces as "Disconnected" rather than silently stalling. */
  useEffect(() => {
    if (status === 'ERROR' || status === 'IDLE') return;

    const timer = setInterval(() => {
      captureService.heartbeat({ cameraType }).catch((err) => {
        if (err instanceof ApiClientError && err.status === 0) {
          setStatus('DISCONNECTED');
          setMessage('Lost connection to the server. Reconnecting…');
        }
      });
    }, HEARTBEAT_MS);

    return () => clearInterval(timer);
  }, [status, cameraType]);

  /**
   * Release the camera when the tab goes away. The device is *not* explicitly
   * unregistered here: `sendBeacon` cannot carry the device token, and an
   * unload-time fetch is unreliable on mobile. The server reaps devices that
   * stop heart-beating instead, which also covers the cases an unload handler
   * never sees - the phone losing signal, going to sleep, or being switched off.
   */
  useEffect(() => {
    window.addEventListener('pagehide', stopStream);
    return () => {
      window.removeEventListener('pagehide', stopStream);
      stopStream();
    };
  }, [stopStream]);

  async function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const side = Math.min(video.videoWidth, video.videoHeight);
    if (!side) {
      setMessage('Camera is still starting up. Wait a moment and try again.');
      return;
    }

    setStatus('CAPTURING');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(
      video,
      (video.videoWidth - side) / 2,
      (video.videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      side,
      side,
    );

    const perceptualHash = computePerceptualHash(canvas);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setLastPreview(dataUrl);
    setStatus('UPLOADING');

    try {
      await captureService.captureFromDevice({
        image: dataUrl,
        perceptualHash,
        width: side,
        height: side,
        deviceType,
        cameraType,
      });
      setSentCount((count) => count + 1);
      setStatus('SUCCESS');
      setMessage('Photo sent to the desktop.');
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'DUPLICATE_IMAGE') {
        setStatus('DUPLICATE');
        setMessage(err.message);
        setLastPreview(null);
        return;
      }
      if (err instanceof ApiClientError && err.status === 0) {
        setStatus('DISCONNECTED');
        setMessage('Could not reach the server. Check your connection and try again.');
        return;
      }
      setStatus('ERROR');
      setMessage(getErrorMessage(err));
    }
  }

  async function flipCamera() {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    await startCamera(next);
  }

  const statusCopy = STATUS_COPY[status];
  const canCapture = status === 'CONNECTED' || status === 'SUCCESS' || status === 'DUPLICATE';

  return (
    <div className="mobile-capture">
      <header className="mobile-capture-header">
        <div>
          <h1>Capture photo</h1>
          <p className="mobile-capture-session">Session {sessionId.slice(0, 8)}</p>
        </div>
        <span className={`mobile-capture-status mobile-capture-status-${statusCopy.tone}`} role="status">
          {statusCopy.label}
        </span>
      </header>

      <div className="mobile-capture-stage">
        <video ref={videoRef} muted playsInline className="mobile-capture-video" />
        {status === 'UPLOADING' && <div className="mobile-capture-overlay">Sending…</div>}
        {lastPreview && status === 'SUCCESS' && (
          <img src={lastPreview} alt="Last capture" className="mobile-capture-thumb" />
        )}
      </div>
      <canvas ref={canvasRef} hidden />

      {message && (
        <p className={`mobile-capture-message mobile-capture-message-${statusCopy.tone}`} role="alert">
          {message}
        </p>
      )}

      <footer className="mobile-capture-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void flipCamera()}
          disabled={status === 'UPLOADING' || status === 'ERROR'}
        >
          🔄 Flip
        </Button>
        <Button type="button" onClick={() => void capture()} disabled={!canCapture} isLoading={status === 'UPLOADING'}>
          Capture &amp; send
        </Button>
        {status === 'ERROR' && (
          <Button type="button" variant="secondary" onClick={() => void startCamera(facing)}>
            Retry
          </Button>
        )}
      </footer>

      <p className="mobile-capture-footnote">
        {sentCount > 0
          ? `${sentCount} photo${sentCount === 1 ? '' : 's'} sent. You can keep capturing.`
          : 'Hold the phone steady and frame the visitor before capturing.'}
      </p>
    </div>
  );
}
