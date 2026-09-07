import type { ReactNode } from 'react';
import './FilterPanel.css';

export function FilterPanel({ children }: { children: ReactNode }) {
  return <div className="filter-panel">{children}</div>;
}
