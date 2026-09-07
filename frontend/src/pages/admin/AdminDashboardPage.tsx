import { PageHeader } from '../../components/PageHeader';
import { DashboardCard } from '../../components/DashboardCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorState } from '../../components/ErrorState';
import { useAsync } from '../../hooks/useAsync';
import { requestService } from '../../services/requestService';
import '../../components/DashboardGrid.css';

export function AdminDashboardPage() {
  const { data, isLoading, error, reload } = useAsync(() => requestService.dashboard(), []);

  return (
    <div>
      <PageHeader title="Administrator overview" description="Database-backed metrics across the entire constituency service platform." />

      {isLoading && <LoadingSpinner label="Loading dashboard..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={reload} />}
      {!isLoading && !error && data && (
        <>
          <div className="dashboard-grid">
            <DashboardCard label="Total visitors" value={data.allTime.total} hint="All time" />
            <DashboardCard label="Today's visitors" value={data.today.total} hint="Since midnight" />
            <DashboardCard label="Pending requests" value={data.allTime.pending} tone="warning" />
            <DashboardCard label="Approved requests" value={data.allTime.approved} tone="info" />
          </div>
          <div className="dashboard-grid">
            <DashboardCard label="Resolved requests" value={data.allTime.resolved} tone="success" />
            <DashboardCard label="Rejected requests" value={data.allTime.rejected} tone="danger" />
            <DashboardCard label="In meeting" value={data.today.inMeeting} tone="info" />
            <DashboardCard label="Waiting" value={data.today.waiting} tone="warning" />
          </div>
        </>
      )}
    </div>
  );
}
