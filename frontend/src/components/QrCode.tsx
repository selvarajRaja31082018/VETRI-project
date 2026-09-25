import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * QR code rendered to a data URL and shown as an <img>.
 *
 * A data URL rather than a <canvas> because the pass is printed: browsers
 * routinely drop canvas content from a print rendering, whereas an image is
 * always laid out and printed.
 */
export function QrCode({
  value,
  size = 128,
  alt = 'QR code',
  className,
}: {
  value: string;
  size?: number;
  alt?: string;
  className?: string;
}) {
  // One state object tagged with the value it was produced for. Deriving
  // "still rendering" from that tag avoids resetting state synchronously
  // inside the effect every time `value` changes.
  const [result, setResult] = useState<{ value: string; src: string | null } | null>(null);
  const isCurrent = result?.value === value;
  const src = isCurrent ? result.src : null;
  const failed = isCurrent && result.src === null;

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(value, {
      width: size * 2, // rendered at 2x so it stays crisp in print
      margin: 1,
      // Higher correction survives a creased or smudged printed pass.
      errorCorrectionLevel: 'M',
      color: { dark: '#221a1c', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setResult({ value, src: url });
      })
      .catch(() => {
        if (!cancelled) setResult({ value, src: null });
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (failed) {
    return (
      <span className={className} style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
        QR unavailable
      </span>
    );
  }

  return src ? (
    <img src={src} alt={alt} width={size} height={size} className={className} />
  ) : (
    <span
      className={className}
      style={{ width: size, height: size, display: 'block', background: 'var(--color-neutral-bg)' }}
      aria-hidden="true"
    />
  );
}
