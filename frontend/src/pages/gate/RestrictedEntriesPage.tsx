import { PageHeader } from '../../components/PageHeader';
import { DashboardCard } from '../../components/DashboardCard';
import { Table, type Column } from '../../components/Table';
import { Button } from '../../components/Button';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../hooks/useToast';
import { restrictionService } from '../../services/restrictionService';
import { getErrorMessage } from '../../utils/errors';
import { formatDate } from '../../utils/formatters';
import type { RestrictedEntry } from '../../types';
import '../../components/DashboardGrid.css';

export function RestrictedEntriesPage() {
  const { showToast } = useToast();
  const { data, isLoading, error, reload } = useAsync(() => restrictionService.list(), []);

  async function handleRecordAttempt(row: RestrictedEntry) {
    try {
      await restrictionService.recordAttempt(row.visitor_id);
      showToast('Attempted entry recorded');
      reload();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  }

  const columns: Column<RestrictedEntry>[] = [
    {
      key: 'visitor',
      header: 'Visitor',
      render: (row) => (
        <div>
          <strong>{row.visitor_name}</strong>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            {row.mobile} · {row.visitor_code}
          </div>
        </div>
      ),
    },
    { key: 'reason', header: 'Restriction reason', render: (row) => row.reason },
    { key: 'since', header: 'Restricted from', render: (row) => formatDate(row.restricted_from) },
    { key: 'attempts', header: 'Attempted entries', render: (row) => row.attempted_entries },
    {
      key: 'action',
      header: 'Gate result',
      render: (row) => (
        <Button size="sm" variant="secondary" onClick={() => handleRecordAttempt(row)}>
          Record attempted entry
        </Button>
      ),
    },
  ];

  const total = data?.length || 0;
  const attempts = data?.reduce((sum, row) => sum + row.attempted_entries, 0) || 0;

  return (
    <div>
      <PageHeader
        title="Restricted entries"
        description="Gate-level watchlist and attempted-entry records set by the PA workspace."
      />

      <div className="dashboard-grid">
        <DashboardCard label="Restricted visitors" value={total} tone="danger" hint="Currently restricted" />
        <DashboardCard label="Attempted entries" value={attempts} tone="warning" hint="Captured since restriction" />
      </div>

      <Table
        columns={columns}
        rows={data || []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        emptyTitle="No restricted visitors"
        emptyDescription="Visitors restricted by the PA will be listed here."
      />
    </div>
  );
}
