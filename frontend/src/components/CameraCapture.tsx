import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadService } from '../services/uploadService';
import { getErrorMessage } from '../utils/errors';
import { Button } from './Button';
import './CameraCapture.css';

type Mode = 'idle' | 'starting' | 'streaming' | 'uploading' | 'captured' | 'error';

interface CameraCaptureProps {
  /** Already-stored photo URL, if this visitor/member was captured earlier. */
  value?: string | null;
  onCapture: (url: string) => void;
  onClear?: () => void;
  size?: 'large' | 'small';
  label?: string;
}

/**
 * Live webcam capture matching the prototype's circular "Identity
 * verification" panel: start the camera, snap a still frame, upload it, and
 * report the stored URL back to the caller.
 */
export function CameraCapture({ value, onCapture, onClear, size = 'large', label }: CameraCaptureProps) {
  const [mode, setMode] = useState<Mode>(value ? 'captured' : 'idle');
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  useEffect(() => {
    if (value) {
      setPreview(value);
      setMode('captured');
    }
  }, [value]);

  async function startCamera() {
    setError(null);
    setMode('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode('streaming');
    } catch (err) {
      setMode('error');
      setError(
        err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
          ? 'Camera access was denied. Allow camera permission for this site and try again.'
          : 'Could not access the camera on this device.',
      );
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const side = Math.min(video.videoWidth, video.videoHeight);
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPreview(dataUrl);
    stopStream();
    setMode('uploading');

    try {
      const url = await uploadService.uploadPhoto(dataUrl);
      onCapture(url);
      setMode('captured');
    } catch (err) {
      setError(getErrorMessage(err));
      setMode('error');
    }
  }

  function retake() {
    setPreview(null);
    setError(null);
    onClear?.();
    startCamera();
  }

  return (
    <div className={`camera-capture camera-capture-${size}`}>
      <div className="camera-capture-frame">
        {mode === 'streaming' && <video ref={videoRef} muted playsInline className="camera-capture-video" />}
        {(mode === 'captured' || mode === 'uploading') && preview && (
          <img src={preview} alt="Captured identity" className="camera-capture-preview" />
        )}
        {mode === 'uploading' && <div className="camera-capture-overlay">Uploading...</div>}
        {(mode === 'idle' || mode === 'starting') && (
          <div className="camera-capture-placeholder" aria-hidden="true">
            📷
          </div>
        )}
        {mode === 'error' && (
          <div className="camera-capture-placeholder camera-capture-placeholder-error" aria-hidden="true">
            ⚠️
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {label && <p className="camera-capture-label">{label}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="camera-capture-actions">
        {mode === 'idle' && (
          <Button type="button" size="sm" variant="secondary" onClick={startCamera}>
            Start camera
          </Button>
        )}
        {mode === 'starting' && (
          <Button type="button" size="sm" variant="secondary" isLoading disabled>
            Starting camera
          </Button>
        )}
        {mode === 'streaming' && (
          <Button type="button" size="sm" onClick={captureFrame}>
            Capture Identity
          </Button>
        )}
        {mode === 'error' && (
          <Button type="button" size="sm" variant="secondary" onClick={startCamera}>
            Retry
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
