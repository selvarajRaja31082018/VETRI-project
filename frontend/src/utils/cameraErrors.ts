/**
 * Turn a getUserMedia rejection into something an operator can act on.
 *
 * Shared by the desktop CameraCapture component and the mobile capture page so
 * both surfaces explain a permission denial, a busy camera or an unplugged USB
 * device in the same words.
 */
export function describeCameraError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Camera access was denied. Allow camera permission for this site and try again.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera was found on this device. Connect a camera and try again.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'The camera is already in use by another application. Close it and try again.';
      case 'OverconstrainedError':
        return 'The selected camera is no longer available. Choose a different camera.';
      case 'SecurityError':
        return 'The camera needs a secure (HTTPS) connection. Open this page over HTTPS and try again.';
      default:
        break;
    }
  }
  return 'Could not access the camera on this device.';
}
