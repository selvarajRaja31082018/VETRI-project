import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadService } from '../services/uploadService';
import { captureService } from '../services/captureService';
import { isDuplicatePhotoError } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { computePerceptualHash } from '../utils/imageHash';
import { describeCameraError } from '../utils/cameraErrors';
import { classifyCameraFromStream, detectDeviceType, listVideoInputs, type VideoInput } from '../utils/deviceInfo';
import { Button } from './Button';
import './CameraCapture.css';

type Mode = 'idle' | 'starting' | 'streaming' | 'uploading' | 'captured' | 'duplicate' | 'error';

interface CameraCaptureProps {
  /** Already-stored photo URL, if this visitor/member was captured earlier. */
  value?: string | null;
  onCapture: (url: string) => void;
  onClear?: () => void;
  size?: 'large' | 'small';
  label?: string;
  /**
   * Attach captures to a shared capture session. When set, photos go through
   * the multi-device pipeline (duplicate validation + device provenance +
   * real-time fan-out). When omitted, the component behaves exactly as it
   * always has and posts to the original single-photo upload endpoint.
   */
  sessionId?: string | null;
}

/**
 * Live webcam capture matching the prototype's circular "Identity
 * verification" panel: start the camera, snap a still frame, upload it, and
 * report the stored URL back to the caller.
 *
 * The same component drives every camera class - the built-in webcam, a USB /
 * external camera picked from the selector, and (via MobileCapturePage, which
 * reuses this component) a phone that joined by QR code. Only the transport
 * differs; the capture, hashing and error handling are shared.
 */
export function CameraCapture({ value, onCapture, onClear, size = 'large', label, sessionId }: CameraCaptureProps) {
  const [mode, setMode] = useState<Mode>(value ? 'captured' : 'idle');
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);

  // Camera selection. The list stays empty (and the selector hidden) on a
  // machine with a single camera, so nothing changes for the common desktop.
  const [videoInputs, setVideoInputs] = useState<VideoInput[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // The <video> element stays mounted at all times (visibility is toggled via
  // CSS/`hidden`) so the ref is always attached before getUserMedia resolves.
  // Conditionally rendering it only in 'streaming' mode meant the stream was
  // attached to a ref that didn't exist yet, leaving the element blank and
  // videoWidth/videoHeight stuck at 0 on capture.
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Lazy initial state rather than a ref: the value is computed once, but is
  // read during render, which is what state is for.
  const [deviceType] = useState(detectDeviceType);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  // Sync internal state when the `value` prop changes from outside (e.g. a
  // parent resets the field). Adjusted directly during render rather than in
  // an effect, per React's guidance for state derived from props - this
  // avoids an extra render pass and the "setState in effect" lint warning.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value) {
      setPreview(value);
      setMode('captured');
    }
  }

  const refreshVideoInputs = useCallback(async () => {
    const inputs = await listVideoInputs(deviceType);
    setVideoInputs(inputs);
    return inputs;
  }, [deviceType]);

  // A USB camera unplugged mid-session fires `devicechange`; re-enumerate so
  // the selector never offers hardware that is no longer attached.
  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    const handler = () => void refreshVideoInputs();
    navigator.mediaDevices.addEventListener('devicechange', handler);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handler);
  }, [refreshVideoInputs]);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      setError(null);
      setMode('starting');
      stopStream();

      try {
        const targetDeviceId = deviceId ?? selectedDeviceId;
        const stream = await navigator.mediaDevices.getUserMedia({
          // An explicitly chosen camera is an exact constraint; without one we
          // keep the original front-facing default.
          video: targetDeviceId
            ? { deviceId: { exact: targetDeviceId } }
            : { facingMode: deviceType === 'MOBILE' || deviceType === 'TABLET' ? 'environment' : 'user' },
          audio: false,
        });
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          throw new Error('Video element is not ready');
        }

        // Camera labels are only populated once permission has been granted,
        // so the useful enumeration happens here rather than on mount.
        const inputs = await refreshVideoInputs();
        const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId;
        if (!targetDeviceId && activeId && inputs.some((input) => input.deviceId === activeId)) {
          setSelectedDeviceId(activeId);
        } else if (targetDeviceId) {
          setSelectedDeviceId(targetDeviceId);
        }

        // A camera that is physically disconnected ends its track rather than
        // erroring, so this is the only reliable disconnect signal.
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            stopStream();
            setMode('error');
            setError('The camera was disconnected. Reconnect it or choose another camera, then retry.');
            void refreshVideoInputs();
          };
        });

        video.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Failed to load camera stream'));
        });
        await video.play();
        setMode('streaming');
      } catch (err) {
        stopStream();
        setMode('error');
        setError(describeCameraError(err));
      }
    },
    [deviceType, refreshVideoInputs, selectedDeviceId, stopStream],
  );

  async function switchCamera(deviceId: string) {
    setSelectedDeviceId(deviceId);
    if (mode === 'streaming' || mode === 'error') await startCamera(deviceId);
  }

  async function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const side = Math.min(video.videoWidth, video.videoHeight);
    if (!side) {
      setError('Camera is still starting up. Wait a moment and try again.');
      return;
    }

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

    // Hash the canvas before the stream is torn down - the same frame that is
    // about to be encoded, so the hash always describes what gets uploaded.
    const perceptualHash = computePerceptualHash(canvas);
    const cameraType = classifyCameraFromStream(deviceType, streamRef.current);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPreview(dataUrl);
    stopStream();
    setMode('uploading');
    setError(null);

    try {
      const url = sessionId
        ? (
            await captureService.captureFromDesktop({
              image: dataUrl,
              perceptualHash,
              width: side,
              height: side,
              deviceType,
              cameraType,
              sessionId,
            })
          ).url
        : await uploadService.uploadPhoto(dataUrl);

      onCapture(url);
      setMode('captured');
    } catch (err) {
      // A duplicate is a normal outcome, not a failure: clear the preview so
      // nothing is shown as captured, and tell the operator to take another.
      if (isDuplicatePhotoError(err)) {
        setPreview(null);
        setError(err.message);
        setMode('duplicate');
        return;
      }
      setError(getErrorMessage(err));
      setMode('error');
    }
  }

  function retake() {
    setPreview(null);
    setError(null);
    onClear?.();
    void startCamera();
  }

  const showVideo = mode === 'streaming';
  const showPreview = (mode === 'captured' || mode === 'uploading') && !!preview;
  const showSelector = videoInputs.length > 1 && mode !== 'uploading';

  return (
    <div className={`camera-capture camera-capture-${size}`}>
      <div className="camera-capture-frame">
        <video
          ref={videoRef}
          muted
          playsInline
          className="camera-capture-video"
          hidden={!showVideo}
        />
        {showPreview && <img src={preview} alt="Captured identity" className="camera-capture-preview" />}
        {mode === 'uploading' && <div className="camera-capture-overlay">Uploading...</div>}
        {(mode === 'idle' || mode === 'starting') && (
          <div className="camera-capture-placeholder" aria-hidden="true">
            📷
          </div>
        )}
        {mode === 'duplicate' && (
          <div className="camera-capture-placeholder camera-capture-placeholder-duplicate" aria-hidden="true">
            🔁
          </div>
        )}
        {mode === 'error' && (
          <div className="camera-capture-placeholder camera-capture-placeholder-error" aria-hidden="true">
            ⚠️
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {showSelector && (
        <label className="camera-capture-select">
          <span className="camera-capture-select-label">Camera</span>
          <select
            value={selectedDeviceId}
            onChange={(event) => void switchCamera(event.target.value)}
            aria-label="Select camera"
          >
            {videoInputs.map((input) => (
              <option key={input.deviceId} value={input.deviceId}>
                {input.label}
                {input.cameraType === 'USB_EXTERNAL' ? ' (USB)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {label && <p className="camera-capture-label">{label}</p>}
      {error && (
        <p className={mode === 'duplicate' ? 'camera-capture-duplicate-message' : 'field-error'} role="alert">
          {error}
        </p>
      )}

      <div className="camera-capture-actions">
        {mode === 'idle' && (
          <Button type="button" size="sm" variant="secondary" onClick={() => void startCamera()}>
            Start camera
          </Button>
        )}
        {mode === 'starting' && (
          <Button type="button" size="sm" variant="secondary" isLoading disabled>
            Starting camera
          </Button>
        )}
        {mode === 'streaming' && (
          <Button type="button" size="sm" onClick={() => void captureFrame()}>
            Capture Identity
          </Button>
        )}
        {(mode === 'error' || mode === 'duplicate') && (
          <Button type="button" size="sm" variant="secondary" onClick={() => void startCamera()}>
            {mode === 'duplicate' ? 'Capture a new photo' : 'Retry'}
          </Button>
        )}
        {mode === 'captured' && (
          <Button type="button" size="sm" variant="secondary" onClick={retake}>
            Capture again
          </Button>
        )}
      </div>
    </div>
  );
}
