import type { ReactNode } from 'react';
import './StatusBadge.css';
import { PRIORITY_TONE, STATUS_LABELS, STATUS_TONE } from '../utils/constants';
import type { Priority, RequestStatus } from '../types';

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`badge badge-${STATUS_TONE[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge badge-${PRIORITY_TONE[priority]}`}>{priority}</span>;
}

export function Badge({ tone, children }: { tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
