import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { SearchBar } from '../../components/SearchBar';
import { FilterPanel } from '../../components/FilterPanel';
import { Table, type Column } from '../../components/Table';
import { Pagination } from '../../components/Pagination';
import { Badge } from '../../components/StatusBadge';
import { useAsync } from '../../hooks/useAsync';
import { visitorService } from '../../services/visitorService';
import { formatDate } from '../../utils/formatters';
import type { Visitor } from '../../types';

export function AdminVisitorsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, reload } = useAsync(
    () => visitorService.list({ search: search || undefined, page, limit: 12 }),
    [search, page],
  );

  const columns: Column<Visitor>[] = [
    { key: 'code', header: 'Visitor code', render: (row) => row.visitor_code },
    { key: 'name', header: 'Name', render: (row) => row.name },
    { key: 'mobile', header: 'Mobile', render: (row) => row.mobile },
    { key: 'constituency', header: 'Constituency', render: (row) => row.constituency || '-' },
    {
      key: 'restricted',
      header: 'Restricted',
      render: (row) => (row.is_restricted ? <Badge tone="danger">Restricted</Badge> : <Badge tone="neutral">No</Badge>),
    },
    { key: 'created', header: 'Registered', render: (row) => formatDate(row.created_at) },
  ];

  return (
    <div>
      <PageHeader title="Visitors" description="Master list of every visitor registered across all gates." />

      <FilterPanel>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, mobile or code" />
      </FilterPanel>

      <Table
        columns={columns}
        rows={data?.items || []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        emptyTitle="No visitors registered"
        emptyDescription="Visitors registered at the gate will appear here."
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} />}
    </div>
  );
}
