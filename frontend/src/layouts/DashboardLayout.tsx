import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import './DashboardLayout.css';
import { useAuth } from '../hooks/useAuth';
import { NAV_BY_ROLE } from './navConfig';
import { initials } from '../utils/formatters';
import { ROLE_LABELS } from '../utils/constants';

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isNavOpen, setIsNavOpen] = useState(false);

  if (!user) return null;
  const navItems = NAV_BY_ROLE[user.roleCode];

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${isNavOpen ? 'is-open' : ''}`}>
        <div className="app-brand">
          <span className="app-brand-mark">VT</span>
          <div>
            <strong>VETRI</strong>
            <div className="app-brand-sub">People's Service Office</div>
          </div>
        </div>
        <nav className="app-nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `app-nav-link ${isActive ? 'is-active' : ''}`}
              onClick={() => setIsNavOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="app-sidebar-footer">
          <div className="app-user">
            <span className="app-user-avatar">{initials(user.name)}</span>
            <div>
              <div className="app-user-name">{user.name}</div>
              <div className="app-user-role">{ROLE_LABELS[user.roleCode]}</div>
            </div>
          </div>
          <button type="button" className="app-signout" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="app-nav-toggle"
            onClick={() => setIsNavOpen((prev) => !prev)}
            aria-label="Toggle navigation"
            aria-expanded={isNavOpen}
          >
            ☰
          </button>
          <div className="app-topbar-status">
            <span className="status-dot" aria-hidden="true" />
            Office is open · Constituency Service Centre
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
