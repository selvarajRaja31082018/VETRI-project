import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { FilterPanel } from '../../components/FilterPanel';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Table, type Column } from '../../components/Table';
import { Pagination } from '../../components/Pagination';
import { Modal } from '../../components/Modal';
import { useAsync } from '../../hooks/useAsync';
import { auditService } from '../../services/auditService';
import { formatDateTime } from '../../utils/formatters';
import type { AuditLog } from '../../types';

export function AuditLogsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const actions = useAsync(() => auditService.actions(), []);
  const { data, isLoading, error, reload } = useAsync(
    () => auditService.list({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, action: action || undefined, page, limit: 15 }),
    [dateFrom, dateTo, action, page],
  );

  const columns: Column<AuditLog>[] = [
    { key: 'user', header: 'User', render: (row) => row.user_name || 'System' },
    { key: 'action', header: 'Action', render: (row) => row.action },
    { key: 'entity', header: 'Entity', render: (row) => `${row.entity_type}${row.entity_id ? ` #${row.entity_id}` : ''}` },
    { key: 'ip', header: 'IP address', render: (row) => row.ip_address || '-' },
    { key: 'time', header: 'Timestamp', render: (row) => formatDateTime(row.created_at) },
  ];

  return (
    <div>
      <PageHeader title="Audit logs" description="Complete record of important actions across the platform." />

      <FilterPanel>
        <Input type="date" label="From" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <Input type="date" label="To" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        <Select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          options={[{ value: '', label: 'All actions' }, ...(actions.data || []).map((a) => ({ value: a, label: a }))]}
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
        emptyTitle="No audit records"
        emptyDescription="Actions taken across the platform will be logged here."
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} />}

      {selected && (
        <Modal title="Audit record detail" isOpen onClose={() => setSelected(null)}>
          <dl className="detail-list" style={{ gridTemplateColumns: '1fr' }}>
            <div>
              <dt>User</dt>
              <dd>{selected.user_name || 'System'}</dd>
            </div>
            <div>
              <dt>Action</dt>
              <dd>{selected.action}</dd>
            </div>
            <div>
              <dt>Entity</dt>
              <dd>
                {selected.entity_type} {selected.entity_id ? `#${selected.entity_id}` : ''}
              </dd>
            </div>
            <div>
              <dt>IP address</dt>
              <dd>{selected.ip_address || '-'}</dd>
            </div>
            <div>
              <dt>User agent</dt>
              <dd style={{ wordBreak: 'break-word' }}>{selected.user_agent || '-'}</dd>
            </div>
            <div>
              <dt>Timestamp</dt>
              <dd>{formatDateTime(selected.created_at)}</dd>
            </div>
            {!!selected.old_value && (
              <div>
                <dt>Previous value</dt>
                <dd>
                  <pre className="json-block">{JSON.stringify(selected.old_value, null, 2)}</pre>
                </dd>
              </div>
            )}
            {!!selected.new_value && (
              <div>
                <dt>New value</dt>
                <dd>
                  <pre className="json-block">{JSON.stringify(selected.new_value, null, 2)}</pre>
                </dd>
              </div>
            )}
          </dl>
        </Modal>
      )}
    </div>
  );
}
