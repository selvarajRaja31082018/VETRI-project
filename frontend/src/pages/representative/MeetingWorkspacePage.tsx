import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { Select } from '../../components/Select';
import { Textarea } from '../../components/Textarea';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import { useAsync } from '../../hooks/useAsync';
import { useDepartments } from '../../hooks/useMasterData';
import { useToast } from '../../hooks/useToast';
import { meetingService } from '../../services/meetingService';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime } from '../../utils/formatters';
import { PRIORITIES } from '../../utils/constants';
import type { Priority } from '../../types';

const GRIEVANCE_CATEGORIES = ['Civic', 'Welfare', 'Revenue', 'Education', 'Health', 'Other'];

export function MeetingWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const meetingId = Number(id);

  const { data: meeting, isLoading, error, reload } = useAsync(() => meetingService.getById(meetingId), [meetingId]);
  const departments = useDepartments();

  const [grievanceCategory, setGrievanceCategory] = useState('Civic');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [departmentId, setDepartmentId] = useState('');
  const [targetResolutionDate, setTargetResolutionDate] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [resolution, setResolution] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleComplete() {
    if (!resolution.trim()) {
      setFormError('Enter meeting notes / resolution before completing the meeting.');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await meetingService.complete(meetingId, {
        remarks: remarks || undefined,
        resolution: resolution.trim(),
        grievanceCategory,
        priority,
        departmentId: departmentId ? Number(departmentId) : undefined,
        targetResolutionDate: targetResolutionDate || undefined,
        followUpDate: followUpDate || undefined,
      });
      showToast('Grievance forwarded and meeting completed');
      navigate('/representative/meetings');
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <LoadingSpinner label="Loading meeting..." />;
  if (error || !meeting) return <ErrorState message={error || 'Meeting not found'} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title={meeting.visitor_name}
        description={`Request ${meeting.request_code} · ${meeting.visitor_mobile}`}
        action={<StatusBadge status={meeting.request_status} />}
      />

      <Card title="Meeting in progress" className="section-spacing">
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Started {formatDateTime(meeting.started_at)}
        </p>

        {formError && <div className="form-alert-error">{formError}</div>}

        <div className="form-grid-2" style={{ marginTop: '1rem' }}>
          <Select
            label="Grievance type"
            value={grievanceCategory}
            onChange={(e) => setGrievanceCategory(e.target.value)}
            options={GRIEVANCE_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            options={PRIORITIES.map((p) => ({ value: p, label: p }))}
          />
          <Select
            label="Forward to department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            options={(departments.data || []).map((d) => ({ value: String(d.id), label: d.name }))}
            placeholder={departments.isLoading ? 'Loading...' : 'Select department'}
          />
          <div />
          <Input
            label="Estimated resolution date"
            type="date"
            value={targetResolutionDate}
            onChange={(e) => setTargetResolutionDate(e.target.value)}
          />
          <Input label="Follow-up date" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
        </div>

        <Textarea label="Meeting notes" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        <Textarea
          label="Resolution"
          required
          rows={3}
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          hint="Describe the outcome of the meeting and the action agreed with the visitor."
        />

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <Button isLoading={isSubmitting} onClick={handleComplete}>
            Forward grievance &amp; complete meeting
          </Button>
          <Button variant="secondary" onClick={() => navigate('/representative/meetings')}>
            Back to queue
          </Button>
        </div>
      </Card>
    </div>
  );
}
