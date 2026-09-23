import type { ReactNode } from 'react';
import './PageHeader.css';

export function PageHeader({
  title,
  description,
  status,
  action,
}: {
  title: string;
  description?: string;
  /** Small state indicator beside the title, e.g. a `.status-pill`. */
  status?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <div className="page-header-title">
          <h1>{title}</h1>
          {status}
        </div>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}
