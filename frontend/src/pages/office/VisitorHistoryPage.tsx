import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { SearchBar } from '../../components/SearchBar';
import { FilterPanel } from '../../components/FilterPanel';
import { Table, type Column } from '../../components/Table';
import { Pagination } from '../../components/Pagination';
import { StatusBadge } from '../../components/StatusBadge';
import { useAsync } from '../../hooks/useAsync';
import { requestService } from '../../services/requestService';
import { formatDateTime } from '../../utils/formatters';
import type { VisitorRequest } from '../../types';

export function VisitorHistoryPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, reload } = useAsync(
    () => requestService.list({ search: search || undefined, page, limit: 15 }),
    [search, page],
  );

  const columns: Column<VisitorRequest>[] = [
    { key: 'code', header: 'Request', render: (row) => row.request_code },
    { key: 'visitor', header: 'Visitor', render: (row) => row.visitor_name },
    { key: 'purpose', header: 'Purpose', render: (row) => row.purpose },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'requested', header: 'Requested', render: (row) => formatDateTime(row.requested_at) },
    { key: 'resolved', header: 'Resolved', render: (row) => formatDateTime(row.resolved_at) },
  ];

  return (
    <div>
      <PageHeader title="Visitor history" description="Complete record of every visit request handled by this office." />

      <FilterPanel>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, mobile or request code" />
      </FilterPanel>

      <Table
        columns={columns}
        rows={data?.items || []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        emptyTitle="No history yet"
        emptyDescription="Visitor requests will appear here once recorded."
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} />}
    </div>
  );
}
