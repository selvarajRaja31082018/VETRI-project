import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { SearchBar } from '../../components/SearchBar';
import { FilterPanel } from '../../components/FilterPanel';
import { Select } from '../../components/Select';
import { Table, type Column } from '../../components/Table';
import { Pagination } from '../../components/Pagination';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../hooks/useToast';
import { requestService } from '../../services/requestService';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime } from '../../utils/formatters';
import type { RequestStatus, VisitorRequest } from '../../types';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'MEETING', label: 'In meeting' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CHECKED_OUT', label: 'Checked out' },
  { value: 'REJECTED', label: 'Rejected' },
];

export function TodaysVisitorsPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [actingId, setActingId] = useState<number | null>(null);

  const { data, isLoading, error, reload } = useAsync(
    () =>
      requestService.list({
        today: true,
        search: search || undefined,
        status: status || undefined,
        page,
        limit: 10,
      }),
    [search, status, page],
  );

  async function handleCheckIn(row: VisitorRequest) {
    setActingId(row.id);
    try {
      await requestService.checkIn(row.id);
      showToast(`${row.visitor_name} checked in`);
      reload();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActingId(null);
    }
  }

  async function handleCheckOut(row: VisitorRequest) {
    setActingId(row.id);
    try {
      await requestService.checkOut(row.id);
      showToast(`${row.visitor_name} checked out`);
      reload();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActingId(null);
    }
  }

  const columns: Column<VisitorRequest>[] = [
    {
      key: 'visitor',
      header: 'Visitor',
      render: (row) => (
        <div>
          <strong>{row.visitor_name}</strong>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            {row.visitor_mobile} · {row.visitor_code}
          </div>
        </div>
      ),
    },
    { key: 'purpose', header: 'Purpose', render: (row) => row.purpose },
    { key: 'priority', header: 'Priority', render: (row) => <PriorityBadge priority={row.priority} /> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status as RequestStatus} /> },
    { key: 'time', header: 'Requested', render: (row) => formatDateTime(row.requested_at) },
    {
      key: 'actions',
      header: 'Check-in / out',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <Button
            size="sm"
            variant="secondary"
            disabled={!!row.checked_in_at || actingId === row.id}
            isLoading={actingId === row.id}
            onClick={() => handleCheckIn(row)}
          >
            Check-in
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!row.checked_in_at || !!row.checked_out_at || actingId === row.id}
            isLoading={actingId === row.id}
            onClick={() => handleCheckOut(row)}
          >
            Check-out
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Today's visitors" description="Search, filter and manage arrivals for today." />

      <FilterPanel>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, mobile or code" />
        <Select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          options={STATUS_OPTIONS}
        />
      </FilterPanel>

      <Table
        columns={columns}
        rows={data?.items || []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        emptyTitle="No visitors yet today"
        emptyDescription="Registered visitors will appear here as soon as they arrive."
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} />}
    </div>
  );
}
