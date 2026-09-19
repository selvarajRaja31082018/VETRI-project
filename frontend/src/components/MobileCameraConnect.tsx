import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from './Button';
import { Badge } from './StatusBadge';
import { Modal } from './Modal';
import { LoadingSpinner } from './LoadingSpinner';
import type { useCaptureSession } from '../hooks/useCaptureSession';
import type { CameraType, CaptureDevice, CapturedImage, DeviceType } from '../types';
import './MobileCameraConnect.css';

type CaptureSessionApi = ReturnType<typeof useCaptureSession>;

interface MobileCameraConnectProps {
  capture: CaptureSessionApi;
  /** Adopt a photo that arrived from a phone into the form being filled in. */
  onUsePhoto: (image: CapturedImage) => void;
  /** Latest duplicate rejection, so the operator sees why a phone's shot vanished. */
  duplicateMessage?: string | null;
}

const DEVICE_LABELS: Record<DeviceType, string> = {
  DESKTOP: 'Desktop',
  MOBILE: 'Mobile',
  TABLET: 'Tablet',
  EXTERNAL: 'External',
  UNKNOWN: 'Unknown device',
};

const CAMERA_LABELS: Record<CameraType, string> = {
  BUILTIN_WEBCAM: 'Built-in webcam',
  MOBILE_FRONT: 'Front camera',
  MOBILE_REAR: 'Rear camera',
  USB_EXTERNAL: 'USB camera',
  UNKNOWN: 'Camera',
};

const CONNECTION_TONE = {
  IDLE: 'neutral',
  CONNECTING: 'info',
  CONNECTED: 'success',
  RECONNECTING: 'warning',
  CLOSED: 'neutral',
  ERROR: 'danger',
} as const;

const CONNECTION_LABEL = {
  IDLE: 'Not connected',
  CONNECTING: 'Connecting',
  CONNECTED: 'Connected',
  RECONNECTING: 'Reconnecting',
  CLOSED: 'Disconnected',
  ERROR: 'Connection failed',
} as const;

/** Render the join URL as a QR code on a canvas the phone camera can read. */
function QrPanel({ joinUrl }: { joinUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, joinUrl, { width: 220, margin: 1, errorCorrectionLevel: 'M' }).catch(() =>
      setError('Could not render the QR code. Use the link below instead.'),
    );
  }, [joinUrl]);

  return (
    <div className="mobile-connect-qr">
      <canvas ref={canvasRef} aria-label="QR code to connect a mobile camera" />
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function DeviceRow({ device }: { device: CaptureDevice }) {
  const connected = device.status === 'CONNECTED';
  return (
    <li className="mobile-connect-device">
      <span className={`mobile-connect-dot ${connected ? 'is-connected' : 'is-disconnected'}`} aria-hidden="true" />
      <div>
        <strong>{DEVICE_LABELS[device.deviceType]}</strong>
        <span className="mobile-connect-device-meta">
          {CAMERA_LABELS[device.cameraType]}
          {device.deviceLabel ? ` · ${device.deviceLabel}` : ''}
        </span>
      </div>
      <Badge tone={connected ? 'success' : 'neutral'}>{connected ? 'Connected' : 'Disconnected'}</Badge>
    </li>
  );
}

/**
 * Desktop half of the mobile-camera flow: shows the QR code that puts a phone
 * into the same capture session, lists the devices that have joined, and
 * streams in their photos as they are taken.
 */
export function MobileCameraConnect({ capture, onUsePhoto, duplicateMessage }: MobileCameraConnectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { session, devices, connectedDevices, images, connection, error, start, refreshQr, close } = capture;

  async function handleOpen() {
    setIsOpen(true);
    // Sessions are opened lazily: an operator who never uses a phone never
    // creates one.
    if (!session) await start();
  }

  async function handleClose() {
    setIsOpen(false);
  }

  const mobileImages = images.filter((image) => image.deviceType !== 'DESKTOP');

  return (
    <>
      <div className="mobile-connect-trigger">
        <Button type="button" size="sm" variant="secondary" onClick={() => void handleOpen()}>
          📱 Connect Mobile Camera
        </Button>
        {connectedDevices.length > 0 && (
          <Badge tone="success">
            {connectedDevices.length} device{connectedDevices.length === 1 ? '' : 's'} connected
          </Badge>
        )}
      </div>

      <Modal title="Connect a mobile camera" isOpen={isOpen} onClose={() => void handleClose()} width={620}>
        <div className="mobile-connect-status">
          <Badge tone={CONNECTION_TONE[connection]}>{CONNECTION_LABEL[connection]}</Badge>
          {session && (
            <span className="mobile-connect-session-id" title="Session ID">
              Session {session.sessionId.slice(0, 8)}
            </span>
          )}
        </div>

        {error && (
          <div role="alert" className="form-alert-error">
            {error}
          </div>
        )}
        {/* A duplicate is never added to "Photos received" - the server stored
            nothing - so the rejection is reported here instead. */}
        {duplicateMessage && (
          <div role="alert" className="mobile-connect-duplicate">
            <strong>❌ Duplicate Photo</strong>
            <span>{duplicateMessage}</span>
          </div>
        )}

        {!session && connection === 'CONNECTING' && <LoadingSpinner label="Opening capture session" />}

        {session && (
          <div className="mobile-connect-body">
            <div>
              <QrPanel joinUrl={session.joinUrl} />
              <p className="mobile-connect-hint">
                Scan with the phone's camera. The phone opens the capture page and joins this session - it does
                not need to sign in. Up to {session.maxDevices} devices can join at once.
              </p>
              <div className="mobile-connect-qr-actions">
                <Button type="button" size="sm" variant="secondary" onClick={() => void refreshQr()}>
                  Refresh QR code
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => void close()}>
                  End session
                </Button>
              </div>
            </div>

            <div className="mobile-connect-side">
              <h3 className="mobile-connect-heading">Connected devices</h3>
              {devices.length === 0 ? (
                <p className="mobile-connect-empty">Waiting for a device to scan the code…</p>
              ) : (
                <ul className="mobile-connect-devices">
                  {devices.map((device) => (
                    <DeviceRow key={device.deviceId} device={device} />
                  ))}
                </ul>
              )}

              <h3 className="mobile-connect-heading">Photos received</h3>
              {mobileImages.length === 0 ? (
                <p className="mobile-connect-empty">Photos captured on a phone appear here instantly.</p>
              ) : (
                <ul className="mobile-connect-photos">
                  {mobileImages.map((image) => (
                    <li key={image.imageId}>
                      <img src={image.url} alt={`Captured on ${DEVICE_LABELS[image.deviceType]}`} />
                      <div>
                        <span className="mobile-connect-device-meta">
                          {CAMERA_LABELS[image.cameraType]} ·{' '}
                          {new Date(image.capturedAt).toLocaleTimeString()}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            onUsePhoto(image);
                            setIsOpen(false);
                          }}
                        >
                          Use this photo
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
