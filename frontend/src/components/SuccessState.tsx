import type { ReactNode } from 'react';
import './StateBlock.css';
import { IconCheck } from './icons';

/**
 * Confirmation panel shown after an operation succeeds.
 *
 * Presentation only - it renders whatever the existing API already returned
 * (a reference code, an id) and offers the obvious next actions. It performs
 * no requests of its own.
 */
export function SuccessState({
  title,
  description,
  /** Labelled reference from the response, e.g. "Token" / "VR-00123". */
  referenceLabel,
  reference,
  children,
}: {
  title: string;
  description?: string;
  referenceLabel?: string;
  reference?: string;
  /** Next actions - usually two buttons. */
  children?: ReactNode;
}) {
  return (
    <div className="state-block state-success animate-in" role="status">
      <span className="state-icon state-icon-success" aria-hidden="true">
        <IconCheck size={26} />
      </span>
      <h3>{title}</h3>
      {reference && (
        <p className="state-reference">
          {referenceLabel && <span>{referenceLabel}</span>}
          <strong>{reference}</strong>
        </p>
      )}
      {description && <p>{description}</p>}
      {children && <div className="state-actions">{children}</div>}
    </div>
  );
}
