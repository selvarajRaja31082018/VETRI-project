import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { SearchBar } from '../../components/SearchBar';
import { FilterPanel } from '../../components/FilterPanel';
import { Select } from '../../components/Select';
import { Table, type Column } from '../../components/Table';
import { Pagination } from '../../components/Pagination';
import { Badge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../hooks/useToast';
import { userService, type CreateUserPayload } from '../../services/userService';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';
import { formatDate } from '../../utils/formatters';
import { ROLE_LABELS } from '../../utils/constants';
import type { RoleCode, UserAccount } from '../../types';

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as RoleCode[]).map((code) => ({ value: code, label: ROLE_LABELS[code] }));

export function UsersPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<UserAccount | null>(null);

  const { data, isLoading, error, reload } = useAsync(
    () =>
      userService.list({
        search: search || undefined,
        role: (role || undefined) as RoleCode | undefined,
        status: (status || undefined) as 'active' | 'inactive' | undefined,
        page,
        limit: 10,
      }),
    [search, role, status, page],
  );

  async function handleToggleStatus() {
    if (!pendingStatusChange) return;
    try {
      await userService.setStatus(pendingStatusChange.id, pendingStatusChange.is_active === 0);
      showToast(pendingStatusChange.is_active === 0 ? 'User activated' : 'User deactivated');
      reload();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setPendingStatusChange(null);
    }
  }

  async function handleResetPassword(user: UserAccount) {
    try {
      const result = await userService.resetPassword(user.id);
      showToast(`Temporary password for ${user.name}: ${result.temporaryPassword}`, 'info');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  }

  const columns: Column<UserAccount>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <strong>{row.name}</strong>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            {row.email || row.mobile || '-'}
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (row) => ROLE_LABELS[row.role_code] },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    { key: 'created', header: 'Created', render: (row) => formatDate(row.created_at) },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <Button size="sm" variant="secondary" onClick={() => handleResetPassword(row)}>
            Reset password
          </Button>
          <Button size="sm" variant={row.is_active ? 'danger' : 'secondary'} onClick={() => setPendingStatusChange(row)}>
            {row.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Create and manage accounts for Gate Operators, Office Staff, Representatives and Administrators."
        action={<Button onClick={() => setIsCreateOpen(true)}>Create user</Button>}
      />

      <FilterPanel>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, email or mobile" />
        <Select
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          options={[{ value: '', label: 'All roles' }, ...ROLE_OPTIONS]}
        />
        <Select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </FilterPanel>

      <Table
        columns={columns}
        rows={data?.items || []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        emptyTitle="No users found"
        emptyDescription="Create the first account to get started."
      />
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} />}

      {isCreateOpen && (
        <CreateUserModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!pendingStatusChange}
        title={pendingStatusChange?.is_active ? 'Deactivate user' : 'Activate user'}
        message={
          pendingStatusChange?.is_active
            ? `${pendingStatusChange?.name} will no longer be able to sign in.`
            : `${pendingStatusChange?.name} will be able to sign in again.`
        }
        confirmLabel={pendingStatusChange?.is_active ? 'Deactivate' : 'Activate'}
        variant={pendingStatusChange?.is_active ? 'danger' : 'primary'}
        onConfirm={handleToggleStatus}
        onCancel={() => setPendingStatusChange(null)}
      />
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState<CreateUserPayload>({ name: '', email: '', mobile: '', roleCode: 'G', designation: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const created = await userService.create(form);
      showToast(
        created.temporaryPassword
          ? `User created. Temporary password: ${created.temporaryPassword}`
          : 'User created',
      );
      onCreated();
    } catch (err) {
      setFormError(getErrorMessage(err));
      setFieldErrors(getFieldErrors(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title="Create user"
      isOpen
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isSubmitting} onClick={handleSubmit}>
            Create user
          </Button>
        </>
      }
    >
      {formError && <div className="form-alert-error">{formError}</div>}
      <Input
        label="Full name"
        required
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        error={fieldErrors.name}
      />
      <Input
        label="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        error={fieldErrors.email}
        hint="Provide an email or mobile number"
      />
      <Input
        label="Mobile"
        value={form.mobile}
        onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
        error={fieldErrors.mobile}
      />
      <Select
        label="Role"
        required
        value={form.roleCode}
        onChange={(e) => setForm((f) => ({ ...f, roleCode: e.target.value as RoleCode }))}
        options={ROLE_OPTIONS}
      />
      {form.roleCode === 'R' && (
        <Input
          label="Designation"
          value={form.designation}
          onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
          placeholder="e.g. MLA, Ward Councillor"
        />
      )}
      <p className="field-hint">
        A temporary password is generated automatically and shown once after creation.
      </p>
    </Modal>
  );
}
