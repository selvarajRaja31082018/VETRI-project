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
import type { VisitorRequest } from '../../types';

export function AssignedVisitorsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, reload } = useAsync(
    () => requestService.list({ search: search || undefined, page, limit: 12 }),
    [search, page],
  );

  const columns: Column<VisitorRequest>[] = [
    { key: 'visitor', header: 'Visitor', render: (row) => row.visitor_name },
    { key: 'purpose', header: 'Purpose', render: (row) => row.purpose },
    { key: 'priority', header: 'Priority', render: (row) => <PriorityBadge priority={row.priority} /> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'time', header: 'Assigned', render: (row) => formatDateTime(row.approved_at) },
  ];

  return (
    <div>
      <PageHeader title="Assigned visitors" description="Every visitor currently or previously assigned to you." />

      <FilterPanel>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name or purpose" />
      </FilterPanel>

      <Table
        columns={columns}
        rows={data?.items || []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        emptyTitle="No visitors assigned yet"
        emptyDescription="Visitors approved and assigned by the office staff will appear here."
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} />}
    </div>
  );
}
