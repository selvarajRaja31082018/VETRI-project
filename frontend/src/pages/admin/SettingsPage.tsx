import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { Select } from '../../components/Select';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Badge } from '../../components/StatusBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useDepartments, useVisitReasons } from '../../hooks/useMasterData';
import { useToast } from '../../hooks/useToast';
import { useAsync } from '../../hooks/useAsync';
import { masterDataService } from '../../services/masterDataService';
import { settingsService } from '../../services/settingsService';
import { getErrorMessage } from '../../utils/errors';
import { VISITOR_TYPES } from '../../utils/constants';
import type { VisitorType } from '../../types';

export function SettingsPage() {
  const { showToast } = useToast();

  const settings = useAsync(() => settingsService.list(), []);
  const [officeName, setOfficeName] = useState('');
  const [officeHours, setOfficeHours] = useState('');
  const [isSavingOffice, setIsSavingOffice] = useState(false);
  const [officeInitialised, setOfficeInitialised] = useState(false);

  if (!officeInitialised && settings.data) {
    setOfficeInitialised(true);
    setOfficeName(settings.data.find((s) => s.setting_key === 'office_name')?.setting_value || '');
    setOfficeHours(settings.data.find((s) => s.setting_key === 'office_hours')?.setting_value || '');
  }

  async function handleSaveOfficeDetails() {
    setIsSavingOffice(true);
    try {
      await Promise.all([
        settingsService.update('office_name', officeName.trim()),
        settingsService.update('office_hours', officeHours.trim()),
      ]);
      showToast('Office details updated');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsSavingOffice(false);
    }
  }

  const [visitorType, setVisitorType] = useState<VisitorType>('General Public');
  const [newReason, setNewReason] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [isSavingReason, setIsSavingReason] = useState(false);
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Admin configuration must see inactive entries too, otherwise toggling
  // something off makes it vanish from this list with no way back.
  const reasons = useVisitReasons(visitorType, { includeInactive: true });
  const departments = useDepartments({ includeInactive: true });

  async function handleAddReason() {
    if (!newReason.trim()) return;
    setIsSavingReason(true);
    try {
      await masterDataService.addReason(visitorType, newReason.trim());
      setNewReason('');
      showToast('Reason added');
      reasons.reload();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsSavingReason(false);
    }
  }

  async function handleAddDepartment() {
    if (!newDepartment.trim()) return;
    setIsSavingDepartment(true);
    try {
      await masterDataService.addDepartment(newDepartment.trim());
      setNewDepartment('');
      showToast('Department added');
      departments.reload();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsSavingDepartment(false);
    }
  }

  async function toggleReason(id: number, isActive: boolean) {
    try {
      await masterDataService.setReasonActive(id, !isActive);
      reasons.reload();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  }

  async function toggleDepartment(id: number, isActive: boolean) {
    try {
      await masterDataService.setDepartmentActive(id, !isActive);
      departments.reload();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  }

  async function handleReset() {
    setIsResetting(true);
    try {
      await masterDataService.resetToDefaults();
      showToast('Master data reset to defaults');
      reasons.reload();
      departments.reload();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsResetting(false);
      setIsResetOpen(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Admin configuration"
        description="Manage reasons for visit and referral departments. Additions appear immediately across the Gate, PA and Representative workspaces."
        action={
          <Button variant="secondary" onClick={() => setIsResetOpen(true)}>
            Reset to defaults
          </Button>
        }
      />

      <Card title="Office details" className="section-spacing">
        <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
          Shown in the workspace header for every signed-in role. Leave blank to show the default "VETRI workspace" label.
        </p>
        <div className="form-grid-2">
          <Input
            label="Office name"
            value={officeName}
            onChange={(e) => setOfficeName(e.target.value)}
            placeholder="Constituency Service Centre - Chennai"
          />
          <Input
            label="Office hours"
            value={officeHours}
            onChange={(e) => setOfficeHours(e.target.value)}
            placeholder="Monday-Saturday, 9:00 AM-6:00 PM"
          />
        </div>
        <Button isLoading={isSavingOffice} onClick={handleSaveOfficeDetails}>
          Save office details
        </Button>
      </Card>

      <div className="two-col">
        <Card title="Reasons by visitor type">
          <Select
            label="Visitor type"
            value={visitorType}
            onChange={(e) => setVisitorType(e.target.value as VisitorType)}
            options={VISITOR_TYPES.map((t) => ({ value: t, label: t }))}
          />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="New reason for visit"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Example: Employment"
              />
            </div>
            <Button isLoading={isSavingReason} disabled={!newReason.trim()} onClick={handleAddReason} style={{ marginBottom: '1rem' }}>
              + Add reason
            </Button>
          </div>

          <div className="settings-list">
            {reasons.data?.map((reason) => (
              <div key={reason.id} className="settings-list-row">
                <span>{reason.reason}</span>
                <button type="button" className="settings-toggle" onClick={() => toggleReason(reason.id, !!reason.is_active)}>
                  <Badge tone={reason.is_active ? 'success' : 'neutral'}>{reason.is_active ? 'Active' : 'Inactive'}</Badge>
                </button>
              </div>
            ))}
            {reasons.data?.length === 0 && <p className="field-hint">No reasons yet for this visitor type.</p>}
          </div>
        </Card>

        <Card title="Referral departments">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="New department name"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="Example: Adi Dravidar Welfare"
              />
            </div>
            <Button
              isLoading={isSavingDepartment}
              disabled={!newDepartment.trim()}
              onClick={handleAddDepartment}
              style={{ marginBottom: '1rem' }}
            >
              + Add department
            </Button>
          </div>

          <div className="settings-list">
            {departments.data?.map((department) => (
              <div key={department.id} className="settings-list-row">
                <span>{department.name}</span>
                <button
                  type="button"
                  className="settings-toggle"
                  onClick={() => toggleDepartment(department.id, !!department.is_active)}
                >
                  <Badge tone={department.is_active ? 'success' : 'neutral'}>
                    {department.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </button>
              </div>
            ))}
            {departments.data?.length === 0 && <p className="field-hint">No departments added yet.</p>}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={isResetOpen}
        title="Reset master data to defaults"
        message="Every reason and department outside the default set will be deactivated (not deleted), and all default reasons and departments will be restored and re-activated. Visitor and request records are never affected."
        confirmLabel="Reset to defaults"
        variant="danger"
        isLoading={isResetting}
        onConfirm={handleReset}
        onCancel={() => setIsResetOpen(false)}
      />
    </div>
  );
}
