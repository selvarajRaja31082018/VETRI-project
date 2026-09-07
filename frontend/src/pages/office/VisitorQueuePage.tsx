import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { SearchBar } from '../../components/SearchBar';
import { FilterPanel } from '../../components/FilterPanel';
import { Table, type Column } from '../../components/Table';
import { Pagination } from '../../components/Pagination';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { useAsync } from '../../hooks/useAsync';
import { requestService } from '../../services/requestService';
import { formatDateTime } from '../../utils/formatters';
import { RequestActionPanel } from './RequestActionPanel';
import type { VisitorRequest } from '../../types';

export function VisitorQueuePage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<VisitorRequest | null>(null);

  const { data, isLoading, error, reload } = useAsync(
    () =>
      requestService.list({
        status: ['APPROVED', 'ASSIGNED', 'WAITING'],
        search: search || undefined,
        page,
        limit: 10,
      }),
    [search, page],
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
    { key: 'representative', header: 'Representative', render: (row) => row.representative_name || 'Not assigned' },
    { key: 'priority', header: 'Priority', render: (row) => <PriorityBadge priority={row.priority} /> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'time', header: 'Approved', render: (row) => formatDateTime(row.approved_at) },
  ];

  return (
    <div>
      <PageHeader title="Waiting room" description="Visitors approved and waiting for a representative meeting." />

      <FilterPanel>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name or mobile" />
      </FilterPanel>

      <Table
        columns={columns}
        rows={data?.items || []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        onRowClick={setSelected}
        emptyTitle="Waiting room is empty"
        emptyDescription="Approved visitors will appear here until a representative meets them."
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} />}

      {selected && <RequestActionPanel request={selected} onClose={() => setSelected(null)} onUpdated={reload} />}
    </div>
  );
}
