import type { CameraType, DeviceType } from '../types';

/**
 * Best-effort identification of the hardware behind a capture, recorded against
 * every stored photo. None of this is a security boundary - the server never
 * trusts it for authorisation, it is provenance metadata for the audit trail
 * and for showing the operator which device sent which picture.
 */

/**
 * Browsers removed a reliable "is this a phone" signal years ago, so this
 * combines the UA hints with touch support. `maxTouchPoints` is what separates
 * an iPad (which reports a desktop UA since iPadOS 13) from a real desktop.
 */
export function detectDeviceType(): DeviceType {
  if (typeof navigator === 'undefined') return 'UNKNOWN';

  const ua = navigator.userAgent;
  const touchPoints = navigator.maxTouchPoints || 0;

  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)) return 'TABLET';
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'TABLET';
  if (/iPhone|iPod|Android.+Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return 'MOBILE';
  if (touchPoints > 1 && /Tablet|Touch/i.test(ua)) return 'TABLET';

  return 'DESKTOP';
}

const EXTERNAL_LABEL = /\b(usb|external|logitech|brio|razer|elgato|obsbot|anker|hd\s?pro|capture\s?card)\b/i;
const INTEGRATED_LABEL = /\b(integrated|built[-\s]?in|internal|facetime|hd\s?user\s?facing)\b/i;

/**
 * Decide which camera produced a frame from the device class plus whatever the
 * browser will tell us about the track. Labels are only populated once camera
 * permission has been granted, which is why `facingMode` is consulted first on
 * handheld devices - it is available from the track settings straight away.
 */
export function classifyCamera(
  deviceType: DeviceType,
  label: string | undefined,
  facingMode: string | undefined,
): CameraType {
  const normalisedLabel = label || '';

  if (deviceType === 'MOBILE' || deviceType === 'TABLET') {
    if (facingMode === 'environment' || /back|rear|environment/i.test(normalisedLabel)) return 'MOBILE_REAR';
    if (facingMode === 'user' || /front|face|user/i.test(normalisedLabel)) return 'MOBILE_FRONT';
    return 'MOBILE_REAR'; // handheld capture defaults to the rear camera
  }

  if (EXTERNAL_LABEL.test(normalisedLabel) && !INTEGRATED_LABEL.test(normalisedLabel)) return 'USB_EXTERNAL';
  if (normalisedLabel) return 'BUILTIN_WEBCAM';

  return deviceType === 'DESKTOP' ? 'BUILTIN_WEBCAM' : 'UNKNOWN';
}

/** Read the camera classification straight off a live track. */
export function classifyCameraFromStream(deviceType: DeviceType, stream: MediaStream | null): CameraType {
  const track = stream?.getVideoTracks()[0];
  if (!track) return classifyCamera(deviceType, undefined, undefined);

  const settings = track.getSettings();
  const facingMode = typeof settings.facingMode === 'string' ? settings.facingMode : undefined;
  return classifyCamera(deviceType, track.label, facingMode);
}

export interface VideoInput {
  deviceId: string;
  label: string;
  cameraType: CameraType;
}

/**
 * Enumerate connected cameras so the operator can pick a USB/external one.
 * Labels stay blank until permission has been granted at least once, so the
 * caller should re-enumerate after the first successful getUserMedia.
 */
export async function listVideoInputs(deviceType: DeviceType): Promise<VideoInput[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'videoinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
        cameraType: classifyCamera(deviceType, device.label, undefined),
      }));
  } catch {
    return [];
  }
}

/** Short human label for the device, shown in the desktop's connected-devices list. */
export function describeDevice(deviceType: DeviceType): string {
  const platform = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? 'iOS'
    : /Android/i.test(navigator.userAgent)
      ? 'Android'
      : /Windows/i.test(navigator.userAgent)
        ? 'Windows'
        : /Mac/i.test(navigator.userAgent)
          ? 'macOS'
          : 'Unknown OS';

  const browser = /Edg\//i.test(navigator.userAgent)
    ? 'Edge'
    : /Chrome\//i.test(navigator.userAgent)
      ? 'Chrome'
      : /Firefox\//i.test(navigator.userAgent)
        ? 'Firefox'
        : /Safari\//i.test(navigator.userAgent)
          ? 'Safari'
          : 'Browser';

  const kind = deviceType.charAt(0) + deviceType.slice(1).toLowerCase();
  return `${kind} · ${platform} · ${browser}`;
}
