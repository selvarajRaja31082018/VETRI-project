import type { ReactNode } from 'react';
import './ActionBar.css';

/**
 * Sticky footer holding a form's primary and secondary actions.
 *
 * It stays in view at the bottom of a long form so the operator never has to
 * scroll to find Submit, and stacks to full-width buttons on a phone.
 */
export function ActionBar({
  children,
  /** Optional note on the left - a hint, a validation summary, a saved state. */
  note,
}: {
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="action-bar">
      {note && <div className="action-bar-note">{note}</div>}
      <div className="action-bar-buttons">{children}</div>
    </div>
  );
}
