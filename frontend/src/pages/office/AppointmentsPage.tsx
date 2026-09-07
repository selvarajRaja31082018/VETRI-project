import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { FilterPanel } from '../../components/FilterPanel';
import { Input } from '../../components/Input';
import { Table, type Column } from '../../components/Table';
import { Pagination } from '../../components/Pagination';
import { StatusBadge } from '../../components/StatusBadge';
import { useAsync } from '../../hooks/useAsync';
import { requestService } from '../../services/requestService';
import { formatDate, formatDateTime } from '../../utils/formatters';
import type { VisitorRequest } from '../../types';

export function AppointmentsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, reload } = useAsync(
    () =>
      requestService.list({
        status: ['APPROVED', 'ASSIGNED', 'WAITING', 'MEETING'],
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: 10,
      }),
    [dateFrom, dateTo, page],
  );

  const columns: Column<VisitorRequest>[] = [
    { key: 'visitor', header: 'Visitor', render: (row) => row.visitor_name },
    { key: 'representative', header: 'Representative', render: (row) => row.representative_name || 'Unassigned' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'requested', header: 'Requested on', render: (row) => formatDate(row.requested_at) },
    { key: 'updated', header: 'Last update', render: (row) => formatDateTime(row.updated_at) },
  ];

  return (
    <div>
      <PageHeader title="Appointments" description="Visitors with a scheduled or in-progress meeting." />

      <FilterPanel>
        <Input type="date" label="From" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <Input type="date" label="To" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
      </FilterPanel>

      <Table
        columns={columns}
        rows={data?.items || []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        emptyTitle="No appointments found"
        emptyDescription="Scheduled and in-progress meetings will appear here."
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} />}
    </div>
  );
}
