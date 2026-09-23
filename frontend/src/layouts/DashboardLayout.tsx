import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import './DashboardLayout.css';
import { useAuth } from '../hooks/useAuth';
import { NAV_BY_ROLE } from './navConfig';
import { initials } from '../utils/formatters';
import { ROLE_LABELS } from '../utils/constants';
import { NotificationBell } from '../components/NotificationBell';
import { useAsync } from '../hooks/useAsync';
import { settingsService } from '../services/settingsService';
import { IconChevronRight, IconLogOut, IconMenu, IconClose } from '../components/icons';
import { NAV_ICONS } from '../components/navIcons';

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const settings = useAsync(() => settingsService.list(), []);

  // Lock the page behind the drawer so the content underneath cannot scroll.
  useEffect(() => {
    if (!isNavOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isNavOpen]);

  if (!user) return null;
  const navItems = NAV_BY_ROLE[user.roleCode];

  const officeName = settings.data?.find((s) => s.setting_key === 'office_name')?.setting_value;
  const officeHours = settings.data?.find((s) => s.setting_key === 'office_hours')?.setting_value;
  const workspaceText = officeName
    ? [officeName, officeHours].filter(Boolean).join(' · ')
    : 'VETRI workspace';

  // Breadcrumb trail: "VETRI / <current section>", resolved from the nav entry
  // whose path prefixes the current URL (the longest match wins for nested routes).
  const current = [...navItems]
    .filter((item) => location.pathname.startsWith(item.to))
    .sort((a, b) => b.to.length - a.to.length)[0];

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      {/* Scrim sits under the drawer on small screens only. */}
      <div
        className={`app-scrim ${isNavOpen ? 'is-visible' : ''}`}
        onClick={() => setIsNavOpen(false)}
        aria-hidden="true"
      />

      <aside className={`app-sidebar ${isNavOpen ? 'is-open' : ''}`}>
        <div className="app-brand">
          <span className="app-brand-mark">VT</span>
          <div className="app-brand-text">
            <strong>VETRI</strong>
            <span className="app-brand-sub">People's Service Office</span>
          </div>
          <button
            type="button"
            className="app-drawer-close"
            onClick={() => setIsNavOpen(false)}
            aria-label="Close navigation"
          >
            <IconClose size={18} />
          </button>
        </div>

        <nav className="app-nav" aria-label="Primary">
          <p className="app-nav-heading">Workspace</p>
          {navItems.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `app-nav-link ${isActive ? 'is-active' : ''}`}
                // Closes the mobile drawer from the interaction that navigates,
                // rather than reacting to the route change afterwards.
                onClick={() => setIsNavOpen(false)}
              >
                <span className="app-nav-icon">
                  <Icon size={18} />
                </span>
                <span className="app-nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-user">
            <span className="app-user-avatar">{initials(user.name)}</span>
            <div className="app-user-text">
              <span className="app-user-name">{user.name}</span>
              <span className="app-user-role">{ROLE_LABELS[user.roleCode]}</span>
            </div>
          </div>
          <button type="button" className="app-signout" onClick={handleLogout}>
            <IconLogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="app-nav-toggle"
            onClick={() => setIsNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={isNavOpen}
          >
            <IconMenu size={20} />
          </button>

          <nav className="app-breadcrumb" aria-label="Breadcrumb">
            <span className="app-breadcrumb-root">VETRI</span>
            {current && (
              <>
                <IconChevronRight size={14} className="app-breadcrumb-sep" />
                <span className="app-breadcrumb-current">{current.label}</span>
              </>
            )}
          </nav>

          <div className="app-topbar-spacer" />

          <span className="app-workspace" title={workspaceText}>
            <span className="app-workspace-dot" aria-hidden="true" />
            {workspaceText}
          </span>

          <NotificationBell />

          <span className="app-topbar-avatar" title={`${user.name} · ${ROLE_LABELS[user.roleCode]}`}>
            {initials(user.name)}
          </span>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
