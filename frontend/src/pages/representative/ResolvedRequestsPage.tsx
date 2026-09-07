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

export function ResolvedRequestsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, reload } = useAsync(
    () =>
      requestService.list({
        status: ['RESOLVED', 'CHECKED_OUT'],
        search: search || undefined,
        page,
        limit: 12,
      }),
    [search, page],
  );

  const columns: Column<VisitorRequest>[] = [
    { key: 'visitor', header: 'Visitor', render: (row) => row.visitor_name },
    { key: 'category', header: 'Category', render: (row) => row.grievance_category || row.reason || '-' },
    { key: 'department', header: 'Department', render: (row) => row.department_name || '-' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'resolved', header: 'Resolved on', render: (row) => formatDateTime(row.resolved_at) },
  ];

  return (
    <div>
      <PageHeader title="Resolved requests" description="Grievances you have resolved, forwarded and closed." />

      <FilterPanel>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name or category" />
      </FilterPanel>

      <Table
        columns={columns}
        rows={data?.items || []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        emptyTitle="Nothing resolved yet"
        emptyDescription="Completed meetings with a resolution will appear here."
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} />}
    </div>
  );
}
