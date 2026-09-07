import type { RoleCode } from '../types';

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export const NAV_BY_ROLE: Record<RoleCode, NavItem[]> = {
  G: [
    { to: '/gate/overview', label: 'Overview', end: true },
    { to: '/gate/visitors/new', label: 'Register visitor' },
    { to: '/gate/visitors/returning', label: 'Returning visitor' },
    { to: '/gate/visitors/today', label: "Today's visitors" },
    { to: '/gate/restricted', label: 'Restricted entries' },
  ],
  P: [
    { to: '/office/dashboard', label: 'Overview', end: true },
    { to: '/office/requests', label: 'Pending requests' },
    { to: '/office/queue', label: 'Visitor queue' },
    { to: '/office/appointments', label: 'Appointments' },
    { to: '/office/history', label: 'Visitor history' },
  ],
  R: [
    { to: '/representative/dashboard', label: 'Overview', end: true },
    { to: '/representative/meetings', label: 'Meeting queue' },
    { to: '/representative/assigned', label: 'Assigned visitors' },
    { to: '/representative/resolved', label: 'Resolved requests' },
  ],
  A: [
    { to: '/admin/dashboard', label: 'Overview', end: true },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/representatives', label: 'Representatives' },
    { to: '/admin/visitors', label: 'Visitors' },
    { to: '/admin/reports', label: 'Reports' },
    { to: '/admin/analytics', label: 'Analytics' },
    { to: '/admin/audit-logs', label: 'Audit logs' },
    { to: '/admin/settings', label: 'Settings' },
  ],
};
