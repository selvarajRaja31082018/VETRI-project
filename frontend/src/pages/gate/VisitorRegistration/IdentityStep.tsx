import { Card } from '../../../components/Card';
import { CameraCapture } from '../../../components/CameraCapture';
import { MobileCameraConnect } from '../../../components/MobileCameraConnect';
import type { useCaptureSession } from '../../../hooks/useCaptureSession';
import type { CapturedImage } from '../../../types';

/**
 * Step 1 - identity. The camera itself is the existing `CameraCapture`
 * component, untouched: desktop webcam, USB camera selection and the QR-joined
 * mobile camera all keep working exactly as before.
 */
export function IdentityStep({
  photoUrl,
  onCapture,
  onClear,
  capture,
  duplicateNotice,
  onUseMobilePhoto,
}: {
  photoUrl: string | null;
  onCapture: (url: string) => void;
  onClear: () => void;
  capture: ReturnType<typeof useCaptureSession>;
  duplicateNotice: string | null;
  onUseMobilePhoto: (image: CapturedImage) => void;
}) {
  return (
    <Card
      step="01"
      title="Identity verification"
      subtitle="Capture the visitor's photo with consent. A photo is recommended but not required."
      status={
        <span className={`status-pill ${photoUrl ? 'status-pill-success' : ''}`.trim()}>
          {photoUrl ? 'Photo captured' : 'Awaiting photo'}
        </span>
      }
      enterDelay={0}
    >
      <div className="identity-layout">
        <CameraCapture
          value={photoUrl}
          onCapture={onCapture}
          onClear={onClear}
          label="Stored against this visit record and used for identity verification only."
          sessionId={capture.sessionId}
        />

        <div className="identity-aside">
          <div>
            <h3 className="identity-aside-title">Other capture options</h3>
            <p className="identity-aside-text">
              Use a phone as an extra camera, or pick a USB camera from the device list in the panel.
            </p>
            <MobileCameraConnect
              capture={capture}
              onUsePhoto={onUseMobilePhoto}
              duplicateMessage={duplicateNotice}
            />
          </div>

          <div className="identity-tips">
            <h4>For a usable photo</h4>
            <ul>
              <li>Face the visitor towards the light, not a window behind them.</li>
              <li>Frame head and shoulders inside the guide oval.</li>
              <li>Ask the visitor to remove a helmet or face covering.</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
