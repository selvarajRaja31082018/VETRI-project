import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { DashboardCard } from '../../components/DashboardCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { useAsync } from '../../hooks/useAsync';
import { requestService } from '../../services/requestService';
import { formatDateTime } from '../../utils/formatters';
import '../../components/DashboardGrid.css';

export function OfficeDashboardPage() {
  const { data, isLoading, error, reload } = useAsync(() => requestService.dashboard(), []);
  const priority = useAsync(
    () => requestService.list({ status: 'PENDING_APPROVAL', priority: 'HIGH', limit: 5 }),
    [],
  );
  const queue = useAsync(() => requestService.list({ today: true, limit: 6 }), []);

  return (
    <div>
      <PageHeader
        title="Good morning. The service desk is ready."
        description="Review new requests, manage the waiting room and track appointments."
        action={
          <Link to="/office/requests" className="btn btn-primary btn-md">
            Review new requests
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

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <h2>Visitors requiring immediate attention</h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {priority.isLoading && <LoadingSpinner />}
            {!priority.isLoading && (priority.data?.items.length ?? 0) === 0 && (
              <p style={{ padding: '1.5rem', color: 'var(--color-text-muted)' }}>No high-priority requests right now.</p>
            )}
            {priority.data?.items.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.visitor_name}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{item.purpose}</div>
                </div>
                <PriorityBadge priority={item.priority} />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Current queue</h2>
            <Link to="/office/queue">View all</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {queue.isLoading && <LoadingSpinner />}
            {queue.data?.items.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.visitor_name}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    {formatDateTime(item.requested_at)}
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
