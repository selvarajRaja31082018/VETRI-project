import type { ReactNode } from 'react';
import './LoadingSpinner.css';

type SpinnerSize = 'sm' | 'md' | 'lg';

/**
 * Inline loading state: a ring plus a label, centred in whatever box it is
 * given. Use for a section or a page area that is waiting on data.
 */
export function LoadingSpinner({
  label = 'Loading...',
  size = 'md',
  inline = false,
}: {
  label?: string;
  size?: SpinnerSize;
  /** Sit on one line with no surrounding padding (inside a button, a row). */
  inline?: boolean;
}) {
  return (
    <div className={`loading-state ${inline ? 'is-inline' : ''}`.trim()} role="status">
      <span className={`loading-spinner loading-spinner-${size}`} aria-hidden="true" />
      {label && <span>{label}</span>}
    </div>
  );
}

/**
 * Blocks an area that is already on screen while something completes - a form
 * submitting, an image processing. The content stays visible underneath, so the
 * operator keeps their context instead of the page emptying out.
 */
export function LoadingOverlay({
  label = 'Working...',
  /** Cover the whole viewport rather than the nearest positioned ancestor. */
  fullscreen = false,
}: {
  label?: string;
  fullscreen?: boolean;
}) {
  return (
    <div
      className={`loading-overlay ${fullscreen ? 'is-fullscreen' : ''}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="loading-overlay-panel">
        <span className="loading-spinner loading-spinner-md" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}

/**
 * Shimmer placeholder shaped like the content that is coming, so the layout
 * does not jump when it arrives.
 */
export function Skeleton({
  width,
  height = 14,
  radius,
  className,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}) {
  return (
    <span
      className={`skeleton ${className || ''}`.trim()}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/** A stack of skeleton lines, for a list or paragraph that is still loading. */
export function SkeletonLines({ lines = 3, gap = 8 }: { lines?: number; gap?: number }) {
  return (
    <span className="skeleton-stack" style={{ gap }} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === lines - 1 ? '60%' : '100%'} />
      ))}
    </span>
  );
}

/** Skeleton shaped like a form field (label + control). */
export function SkeletonField({ label = true }: { label?: boolean }) {
  return (
    <div className="skeleton-field" aria-hidden="true">
      {label && <Skeleton width={90} height={11} />}
      <Skeleton width="100%" height={44} radius={10} />
    </div>
  );
}

/** Wrap children so a loading area can be announced politely to assistive tech. */
export function LoadingRegion({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      {children}
    </div>
  );
}
