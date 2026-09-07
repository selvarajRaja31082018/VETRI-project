import { PageHeader } from '../../components/PageHeader';
import { Table, type Column } from '../../components/Table';
import { Badge } from '../../components/StatusBadge';
import { useAsync } from '../../hooks/useAsync';
import { masterDataService } from '../../services/masterDataService';
import type { Representative } from '../../types';

export function RepresentativesPage() {
  const { data, isLoading, error, reload } = useAsync(() => masterDataService.listRepresentatives(), []);

  const columns: Column<Representative>[] = [
    { key: 'name', header: 'Name', render: (row) => row.name },
    { key: 'designation', header: 'Designation', render: (row) => row.designation || '-' },
    { key: 'contact', header: 'Contact', render: (row) => row.email || row.mobile || '-' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Representatives"
        description="Elected representatives available for visitor assignment. Manage accounts from the Users page."
      />
      <Table
        columns={columns}
        rows={data || []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        emptyTitle="No representatives yet"
        emptyDescription="Create a Representative account from Admin > Users to see them here."
      />
    </div>
  );
}
