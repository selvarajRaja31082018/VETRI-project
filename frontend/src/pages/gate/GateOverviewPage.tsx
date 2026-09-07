import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { DashboardCard } from '../../components/DashboardCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import { useAsync } from '../../hooks/useAsync';
import { requestService } from '../../services/requestService';
import { formatDateTime } from '../../utils/formatters';
import '../../components/DashboardGrid.css';

export function GateOverviewPage() {
  const { data, isLoading, error, reload } = useAsync(() => requestService.dashboard(), []);
  const today = useAsync(() => requestService.list({ today: true, limit: 5 }), []);

  return (
    <div>
      <PageHeader
        title="Good morning. The service desk is ready."
        description="Register arrivals, review restricted entries and track today's visitor queue."
        action={
          <Link to="/gate/visitors/new" className="btn btn-primary btn-md">
            Register a Visitor
          </Link>
        }
      />

      {isLoading && <LoadingSpinner label="Loading dashboard..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={reload} />}
      {!isLoading && !error && data && (
        <div className="dashboard-grid">
          <DashboardCard label="Visitors today" value={data.today.total} hint="Across all service channels" />
          <DashboardCard label="Awaiting approval" value={data.today.pending} tone="warning" hint="PA action required" />
          <DashboardCard label="Ready to meet" value={data.today.waiting} tone="info" hint="In the representative queue" />
          <DashboardCard label="Completed" value={data.today.resolved} tone="success" hint="Visits closed today" />
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2>Current visitor queue</h2>
          <Link to="/gate/visitors/today">View all</Link>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {today.isLoading && <LoadingSpinner />}
          {!today.isLoading && today.data && today.data.items.length === 0 && (
            <p style={{ padding: '1.5rem', color: 'var(--color-text-muted)' }}>No visitors registered yet today.</p>
          )}
          {!today.isLoading &&
            today.data?.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.85rem 1.4rem',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <strong>{item.visitor_name}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    {item.visitor_mobile} · {item.purpose}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    {formatDateTime(item.requested_at)}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
