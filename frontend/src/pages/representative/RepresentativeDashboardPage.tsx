import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { DashboardCard } from '../../components/DashboardCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorState } from '../../components/ErrorState';
import { useAsync } from '../../hooks/useAsync';
import { requestService } from '../../services/requestService';
import '../../components/DashboardGrid.css';

export function RepresentativeDashboardPage() {
  const { data, isLoading, error, reload } = useAsync(() => requestService.dashboard(), []);

  return (
    <div>
      <PageHeader
        title="Constituency Service Intelligence"
        description="Visitor demand, grievance movement and follow-up performance at a glance."
        action={
          <Link to="/representative/meetings" className="btn btn-primary btn-md">
            Open meeting queue
          </Link>
        }
      />

      {isLoading && <LoadingSpinner label="Loading dashboard..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={reload} />}
      {!isLoading && !error && data && (
        <div className="dashboard-grid">
          <DashboardCard label="Meeting queue" value={data.today.waiting + data.today.inMeeting} hint="Approved visitors waiting" />
          <DashboardCard label="Open grievances" value={data.allTime.pending + data.allTime.waiting} tone="warning" hint="Across all departments" />
          <DashboardCard
            label="Resolution rate"
            value={data.allTime.total > 0 ? `${Math.round((data.allTime.resolved / data.allTime.total) * 100)}%` : '0%'}
            tone="success"
            hint="Cases successfully closed"
          />
          <DashboardCard label="Priority cases" value={data.today.pending} tone="danger" hint="Need direct attention" />
        </div>
      )}
    </div>
  );
}
