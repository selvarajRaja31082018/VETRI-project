import type { ReactNode } from 'react';
import './StateBlock.css';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-block state-empty">
      <div className="state-icon" aria-hidden="true">
        📭
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
