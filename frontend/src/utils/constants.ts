import type { Priority, RequestStatus, RoleCode } from '../types';

export const ROLE_HOME: Record<RoleCode, string> = {
  G: '/gate/overview',
  P: '/office/dashboard',
  R: '/representative/dashboard',
  A: '/admin/dashboard',
};

export const ROLE_LABELS: Record<RoleCode, string> = {
  G: 'Gate Operator',
  P: 'Office Staff / PA',
  R: 'Elected Representative',
  A: 'Administrator',
};

export const VISITOR_TYPES = ['General Public', 'Entity Employee', 'Party Cadre', 'Govt Staff', 'Personal'] as const;

export const PRIORITIES: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  REGISTERED: 'Registered',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ASSIGNED: 'Assigned',
  WAITING: 'Waiting',
  MEETING: 'In meeting',
  RESOLVED: 'Resolved',
  CHECKED_OUT: 'Checked out',
  CANCELLED: 'Cancelled',
};

export const STATUS_TONE: Record<RequestStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  REGISTERED: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  ASSIGNED: 'info',
  WAITING: 'warning',
  MEETING: 'info',
  RESOLVED: 'success',
  CHECKED_OUT: 'neutral',
  CANCELLED: 'danger',
};

export const PRIORITY_TONE: Record<Priority, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  LOW: 'neutral',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};
