import type { ReactNode } from 'react';
import './Card.css';

interface CardProps {
  title?: string;
  /** One line under the title explaining what this section is for. */
  subtitle?: string;
  /**
   * Two-digit marker ("01") tying the section to the progress indicator.
   * Purely visual - it does not imply multi-step navigation.
   */
  step?: string;
  /** Status shown at the right of the header, e.g. a `.status-pill`. */
  status?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Staggered entrance delay in ms, for sections mounting together. */
  enterDelay?: number;
}

export function Card({
  title,
  subtitle,
  step,
  status,
  action,
  children,
  className,
  enterDelay,
}: CardProps) {
  const hasHeader = Boolean(title || action || status || subtitle);

  return (
    <section
      className={`card animate-in ${className || ''}`.trim()}
      style={enterDelay ? ({ '--enter-delay': `${enterDelay}ms` } as React.CSSProperties) : undefined}
    >
      {hasHeader && (
        <header className="card-header">
          {step && <span className="card-step">{step}</span>}
          <div className="card-heading">
            {title && <h2>{title}</h2>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {status && <div className="card-status">{status}</div>}
          {action && <div className="card-action">{action}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}
