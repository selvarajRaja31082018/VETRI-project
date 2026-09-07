import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { Textarea } from '../../components/Textarea';
import { Input } from '../../components/Input';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { useDepartments, useRepresentatives } from '../../hooks/useMasterData';
import { useToast } from '../../hooks/useToast';
import { requestService } from '../../services/requestService';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime } from '../../utils/formatters';
import type { VisitorRequest } from '../../types';

type ActionKey = 'approve' | 'reject' | 'priority' | 'schedule' | 'refer' | 'queue';

export function RequestActionPanel({
  request,
  onClose,
  onUpdated,
}: {
  request: VisitorRequest;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { showToast } = useToast();
  const representatives = useRepresentatives();
  const departments = useDepartments();

  const [action, setAction] = useState<ActionKey | null>(null);
  const [representativeId, setRepresentativeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, successMessage: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      await fn();
      showToast(successMessage);
      onUpdated();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderActionForm() {
    switch (action) {
      case 'approve':
        return (
          <>
            <Select
              label="Assign representative (optional)"
              value={representativeId}
              onChange={(e) => setRepresentativeId(e.target.value)}
              options={[
                { value: '', label: 'Approve without assigning yet' },
                ...(representatives.data || []).map((r) => ({ value: String(r.id), label: r.name })),
              ]}
            />
            <Button
              isLoading={isSubmitting}
              onClick={() =>
                run(
                  () =>
                    requestService.approve(request.id, {
                      remarks: remarks || undefined,
                      representativeId: representativeId ? Number(representativeId) : undefined,
                    }),
                  'Request approved',
                )
              }
            >
              Confirm Approve
            </Button>
          </>
        );
      case 'reject':
        return (
          <>
            <Textarea
              label="Rejection reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              variant="danger"
              isLoading={isSubmitting}
              disabled={!reason.trim()}
              onClick={() => run(() => requestService.reject(request.id, reason.trim()), 'Request rejected')}
            >
              Confirm Reject
            </Button>
          </>
        );
      case 'priority':
        return (
          <Button
            isLoading={isSubmitting}
            onClick={() => run(() => requestService.setPriority(request.id, 'HIGH'), 'Marked as high priority')}
          >
            Mark as Priority
          </Button>
        );
      case 'schedule':
        return (
          <>
            <Input
              label="Appointment date"
              type="date"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            <Button
              isLoading={isSubmitting}
              disabled={!remarks}
              onClick={() => run(() => requestService.scheduleAppointment(request.id, remarks), 'Appointment scheduled')}
            >
              Confirm Schedule Appointment
            </Button>
          </>
        );
      case 'refer':
        return (
          <>
            <Select
              label="Department"
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              options={(departments.data || []).map((d) => ({ value: String(d.id), label: d.name }))}
              placeholder="Select department"
            />
            <Button
              isLoading={isSubmitting}
              disabled={!departmentId}
              onClick={() =>
                run(() => requestService.referToDepartment(request.id, Number(departmentId), remarks), 'Request referred to department')
              }
            >
              Confirm Refer to Department
            </Button>
          </>
        );
      case 'queue':
        return (
          <Button isLoading={isSubmitting} onClick={() => run(() => requestService.queue(request.id), 'Visitor kept waiting')}>
            Confirm Keep Waiting
          </Button>
        );
      default:
        return null;
    }
  }

  return (
    <Modal title={request.visitor_name} isOpen onClose={onClose} width={620}>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Visitor information</h3>
          <dl className="detail-list">
            <div>
              <dt>District</dt>
              <dd>{request.district || '-'}</dd>
            </div>
            <div>
              <dt>Constituency</dt>
              <dd>{request.constituency || '-'}</dd>
            </div>
            <div>
              <dt>Visitor type</dt>
              <dd>{request.visitor_type || '-'}</dd>
            </div>
            <div>
              <dt>Requested</dt>
              <dd>{formatDateTime(request.requested_at)}</dd>
            </div>
          </dl>
          <div style={{ background: 'var(--color-warning-bg)', padding: '0.85rem', borderRadius: 8, marginTop: '0.75rem' }}>
            <strong style={{ fontSize: '0.85rem' }}>{request.reason || 'Grievance'}</strong>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{request.purpose}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <StatusBadge status={request.status} />
            <PriorityBadge priority={request.priority} />
          </div>
        </div>

        <div style={{ flex: '1 1 260px' }}>
          {!action && (
            <>
              <h3 style={{ marginBottom: '0.5rem' }}>Choose next step</h3>
              <div className="action-grid">
                <Button variant="secondary" onClick={() => setAction('approve')}>
                  Approve
                </Button>
                <Button variant="secondary" onClick={() => setAction('reject')}>
                  Reject
                </Button>
                <Button variant="secondary" onClick={() => setAction('priority')}>
                  Mark as Priority
                </Button>
                <Button variant="secondary" onClick={() => setAction('schedule')}>
                  Schedule Appointment
                </Button>
                <Button variant="secondary" onClick={() => setAction('refer')}>
                  Refer to Department
                </Button>
                <Button variant="secondary" onClick={() => setAction('queue')}>
                  Keep waiting
                </Button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>
                Every action taken is recorded in the audit trail for accountability.
              </p>
            </>
          )}
          {action && (
            <>
              <button
                type="button"
                onClick={() => setAction(null)}
                style={{ border: 'none', background: 'none', color: 'var(--color-primary)', cursor: 'pointer', marginBottom: '0.75rem', padding: 0 }}
              >
                ← Back to actions
              </button>
              {error && <div className="form-alert-error">{error}</div>}
              {renderActionForm()}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
