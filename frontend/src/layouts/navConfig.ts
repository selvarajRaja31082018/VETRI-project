import type { RoleCode } from '../types';
import type { NavIconName } from '../components/navIcons';

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  /** Line icon shown beside the label; resolved from NAV_ICONS. */
  icon: NavIconName;
}

export const NAV_BY_ROLE: Record<RoleCode, NavItem[]> = {
  G: [
    { to: '/gate/overview', label: 'Overview', end: true, icon: 'grid' },
    { to: '/gate/visitors/new', label: 'Register visitor', icon: 'userPlus' },
    { to: '/gate/visitors/returning', label: 'Returning visitor', icon: 'userCheck' },
    { to: '/gate/visitors/today', label: "Today's visitors", icon: 'users' },
    { to: '/gate/restricted', label: 'Restricted entries', icon: 'shieldAlert' },
  ],
  P: [
    { to: '/office/dashboard', label: 'Overview', end: true, icon: 'grid' },
    { to: '/office/requests', label: 'Pending requests', icon: 'clipboard' },
    { to: '/office/queue', label: 'Visitor queue', icon: 'users' },
    { to: '/office/appointments', label: 'Appointments', icon: 'calendar' },
    { to: '/office/history', label: 'Visitor history', icon: 'history' },
  ],
  R: [
    { to: '/representative/dashboard', label: 'Overview', end: true, icon: 'grid' },
    { to: '/representative/meetings', label: 'Meeting queue', icon: 'calendar' },
    { to: '/representative/assigned', label: 'Assigned visitors', icon: 'users' },
    { to: '/representative/resolved', label: 'Resolved requests', icon: 'userCheck' },
  ],
  A: [
    { to: '/admin/dashboard', label: 'Overview', end: true, icon: 'grid' },
    { to: '/admin/users', label: 'Users', icon: 'users' },
    { to: '/admin/representatives', label: 'Representatives', icon: 'shieldUser' },
    { to: '/admin/visitors', label: 'Visitors', icon: 'userCheck' },
    { to: '/admin/reports', label: 'Reports', icon: 'file' },
    { to: '/admin/analytics', label: 'Analytics', icon: 'chart' },
    { to: '/admin/audit-logs', label: 'Audit logs', icon: 'history' },
    { to: '/admin/settings', label: 'Configuration', icon: 'settings' },
  ],
};
