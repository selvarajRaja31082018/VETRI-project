import type { ReactNode } from 'react';
import './AuthLayout.css';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <h1>VETRI</h1>
        <p>Visitor Engagement, Tracking &amp; Redressal Initiative</p>
        <span className="auth-hero-tag">Constituency Service Platform</span>
      </div>
      <div className="auth-panel">{children}</div>
    </div>
  );
}
