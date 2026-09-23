import './StateBlock.css';
import { Button } from './Button';
import { IconAlert } from './icons';

export function ErrorState({
  message,
  title = 'Something went wrong',
  onRetry,
}: {
  message: string;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-block state-error" role="alert">
      <span className="state-icon state-icon-danger" aria-hidden="true">
        <IconAlert size={22} />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Inline error banner for a form. Keeps the technical detail out of the
 * operator's way while still naming what failed and what to do next.
 */
export function FormErrorBanner({
  title = 'Registration failed',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="form-banner form-banner-error" role="alert">
      <span className="form-banner-icon" aria-hidden="true">
        <IconAlert size={16} />
      </span>
      <div className="form-banner-text">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      {onRetry && (
        <button type="button" className="form-banner-action" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
