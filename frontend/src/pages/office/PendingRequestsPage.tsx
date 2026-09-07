import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { SearchBar } from '../../components/SearchBar';
import { FilterPanel } from '../../components/FilterPanel';
import { Select } from '../../components/Select';
import { Table, type Column } from '../../components/Table';
import { Pagination } from '../../components/Pagination';
import { PriorityBadge } from '../../components/StatusBadge';
import { useAsync } from '../../hooks/useAsync';
import { requestService } from '../../services/requestService';
import { relativeTime } from '../../utils/formatters';
import { RequestActionPanel } from './RequestActionPanel';
import type { VisitorRequest } from '../../types';

export function PendingRequestsPage() {
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<VisitorRequest | null>(null);

  const { data, isLoading, error, reload } = useAsync(
    () =>
      requestService.list({
        status: 'PENDING_APPROVAL',
        search: search || undefined,
        priority: (priority || undefined) as VisitorRequest['priority'] | undefined,
        page,
        limit: 10,
      }),
    [search, priority, page],
  );

  const columns: Column<VisitorRequest>[] = [
    {
      key: 'visitor',
      header: 'Visitor',
      render: (row) => (
        <div>
          <strong>{row.visitor_name}</strong>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{row.visitor_mobile}</div>
        </div>
      ),
    },
    { key: 'request', header: 'Request', render: (row) => row.reason || row.purpose },
    { key: 'priority', header: 'Priority', render: (row) => <PriorityBadge priority={row.priority} /> },
    { key: 'waiting', header: 'Waiting', render: (row) => relativeTime(row.requested_at) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelected(row)}
          style={{ border: 'none', background: 'none', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer' }}
        >
          View details →
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Visitor requests" description="Select a visitor to open the complete request and take the required action." />

      <FilterPanel>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name or mobile" />
        <Select
          value={priority}
          onChange={(e) => { setPriority(e.target.value); setPage(1); }}
          options={[
            { value: '', label: 'All priorities' },
            { value: 'URGENT', label: 'Urgent' },
            { value: 'HIGH', label: 'High' },
            { value: 'NORMAL', label: 'Normal' },
            { value: 'LOW', label: 'Low' },
          ]}
        />
      </FilterPanel>

      <Table
        columns={columns}
        rows={data?.items || []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        onRowClick={setSelected}
        emptyTitle="No pending requests"
        emptyDescription="New visitor requests from the gate will appear here for review."
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} />}

      {selected && (
        <RequestActionPanel
          request={selected}
          onClose={() => setSelected(null)}
          onUpdated={reload}
        />
      )}
    </div>
  );
}
