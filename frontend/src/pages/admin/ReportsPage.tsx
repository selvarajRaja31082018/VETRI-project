import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { FilterPanel } from '../../components/FilterPanel';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Button } from '../../components/Button';
import { Table, type Column } from '../../components/Table';
import { Pagination } from '../../components/Pagination';
import { StatusBadge } from '../../components/StatusBadge';
import { useAsync } from '../../hooks/useAsync';
import { useRepresentatives } from '../../hooks/useMasterData';
import { reportService } from '../../services/reportService';
import { getToken } from '../../services/api';
import { formatDate, formatDateTime } from '../../utils/formatters';
import type { RequestStatus } from '../../types';

type Row = Record<string, unknown>;

export function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [representative, setRepresentative] = useState('');
  const [page, setPage] = useState(1);

  const representatives = useRepresentatives();

  const query = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    status: status || undefined,
    representative: representative ? Number(representative) : undefined,
    page,
    limit: 10,
  };

  const { data, isLoading, error, reload } = useAsync(() => reportService.visitors(query), [
    dateFrom,
    dateTo,
    status,
    representative,
    page,
  ]);

  function downloadCsv(report: 'visitors' | 'requests' | 'meetings' | 'representatives') {
    const url = reportService.downloadUrl(report, query);
    // CSV download requires the auth header, so fetch and save via a blob link.
    fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${report}-report.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      });
  }

  const columns: Column<Row>[] = [
    { key: 'request_code', header: 'Request', render: (row) => String(row.request_code ?? '-') },
    { key: 'visitor_name', header: 'Visitor', render: (row) => String(row.visitor_name ?? '-') },
    { key: 'representative_name', header: 'Representative', render: (row) => String(row.representative_name ?? '-') },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (row.status ? <StatusBadge status={row.status as RequestStatus} /> : '-'),
    },
    { key: 'requested_at', header: 'Requested', render: (row) => formatDateTime(String(row.requested_at ?? '')) },
    { key: 'resolved_at', header: 'Resolved', render: (row) => formatDate(row.resolved_at ? String(row.resolved_at) : null) },
  ];

  return (
    <div>
      <PageHeader title="Reports" description="Filter and export operational data as CSV for offline analysis." />

      <Card title="Filters" className="section-spacing">
        <FilterPanel>
          <Input type="date" label="From" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          <Input type="date" label="To" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          <Select
            label="Status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'RESOLVED', label: 'Resolved' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: 'PENDING_APPROVAL', label: 'Pending approval' },
            ]}
          />
          <Select
            label="Representative"
            value={representative}
            onChange={(e) => { setRepresentative(e.target.value); setPage(1); }}
            options={[
              { value: '', label: 'All representatives' },
              ...(representatives.data || []).map((r) => ({ value: String(r.id), label: r.name })),
            ]}
          />
        </FilterPanel>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => downloadCsv('visitors')}>
            Download visitor report
          </Button>
          <Button variant="secondary" size="sm" onClick={() => downloadCsv('meetings')}>
            Download meeting report
          </Button>
          <Button variant="secondary" size="sm" onClick={() => downloadCsv('representatives')}>
            Download representative performance
          </Button>
        </div>
      </Card>

      <Table
        columns={columns}
        rows={data?.items || []}
        rowKey={(row) => String(row.request_code)}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        emptyTitle="No records for this filter"
        emptyDescription="Adjust the date range or filters and try again."
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} />}
    </div>
  );
}
