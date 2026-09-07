import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Textarea } from '../../components/Textarea';
import { Button } from '../../components/Button';
import { useVisitReasons } from '../../hooks/useMasterData';
import { visitorService } from '../../services/visitorService';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';
import { PRIORITIES, VISITOR_TYPES } from '../../utils/constants';
import type { GroupMember, Priority, VisitorType } from '../../types';

const EMPTY_MEMBER: GroupMember = { name: '', mobile: '', identityType: 'Aadhaar', identityReference: '', address: '' };

export function RegisterVisitorPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('Chennai');
  const [constituency, setConstituency] = useState('');
  const [visitorType, setVisitorType] = useState<VisitorType>('General Public');
  const [reason, setReason] = useState('');
  const [purpose, setPurpose] = useState('');
  const [personToMeet, setPersonToMeet] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [groupSize, setGroupSize] = useState(1);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [consent, setConsent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const reasons = useVisitReasons(visitorType);
  const reasonOptions = useMemo(
    () => (reasons.data || []).map((r) => ({ value: r.reason, label: r.reason })),
    [reasons.data],
  );

  function updateGroupSize(value: number) {
    const size = Math.max(1, Math.min(50, value || 1));
    setGroupSize(size);
    const memberCount = size - 1;
    setMembers((prev) => {
      const next = [...prev];
      while (next.length < memberCount) next.push({ ...EMPTY_MEMBER });
      while (next.length > memberCount) next.pop();
      return next;
    });
  }

  function updateMember(index: number, field: keyof GroupMember, value: string) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (groupSize > 1 && !consent) {
      setFormError('Confirm that every accompanying person has agreed to share their details before continuing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await visitorService.register({
        name,
        mobile,
        address: address || undefined,
        district: district || undefined,
        constituency: constituency || undefined,
        visitorType,
        purpose,
        reason: reason || undefined,
        personToMeet: personToMeet || undefined,
        priority,
        groupSize,
        groupMembers: groupSize > 1 ? members : undefined,
      });
      showToast(`Visitor registered. Token ${result.requestCode} sent to the PA queue.`, 'success');
      navigate('/gate/visitors/today');
    } catch (error) {
      setFormError(getErrorMessage(error));
      setFieldErrors(getFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Register a Visitor"
        description="Capture identity, check restrictions, and create an individual or group meeting request."
      />

      <form onSubmit={handleSubmit} noValidate>
        <Card title="Visitor details" className="section-spacing">
          {formError && (
            <div role="alert" className="form-alert-error">
              {formError}
            </div>
          )}
          <div className="form-grid-2">
            <Input
              label="Full name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
            />
            <Input
              label="Mobile number"
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              error={fieldErrors.mobile}
              placeholder="10-digit mobile"
            />
            <Input
              label="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Optional"
            />
            <Input label="District" value={district} onChange={(e) => setDistrict(e.target.value)} />
            <Input
              label="Constituency"
              value={constituency}
              onChange={(e) => setConstituency(e.target.value)}
              placeholder="Assembly constituency"
            />
            <Select
              label="Visitor type"
              required
              value={visitorType}
              onChange={(e) => {
                setVisitorType(e.target.value as VisitorType);
                setReason('');
              }}
              options={VISITOR_TYPES.map((t) => ({ value: t, label: t }))}
            />
            <Select
              label="Reason for visit"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              options={reasonOptions}
              placeholder={reasons.isLoading ? 'Loading reasons...' : 'Select a reason'}
              disabled={reasons.isLoading}
            />
          </div>
          <Textarea
            label="Purpose / grievance details"
            required
            rows={3}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            error={fieldErrors.purpose}
          />
          <div className="form-grid-2">
            <Input
              label="Person to meet"
              value={personToMeet}
              onChange={(e) => setPersonToMeet(e.target.value)}
              placeholder="Optional"
            />
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              options={PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
          </div>
          <Input
            label="Number of persons in this visit"
            type="number"
            min={1}
            max={50}
            value={groupSize}
            onChange={(e) => updateGroupSize(Number(e.target.value))}
            hint={groupSize > 1 ? `Group visit - ${groupSize} people. One meeting request will be created.` : undefined}
          />
        </Card>

        {members.length > 0 && (
          <Card title="Capture every accompanying person" className="section-spacing">
            {members.map((member, index) => (
              <div key={index} className="group-member-block">
                <div className="group-member-index">{index + 2}</div>
                <div className="form-grid-2" style={{ flex: 1 }}>
                  <Input
                    label="Full name"
                    required
                    value={member.name}
                    onChange={(e) => updateMember(index, 'name', e.target.value)}
                  />
                  <Input
                    label="Mobile number"
                    value={member.mobile}
                    onChange={(e) => updateMember(index, 'mobile', e.target.value)}
                  />
                  <Select
                    label="Identity type"
                    value={member.identityType}
                    onChange={(e) => updateMember(index, 'identityType', e.target.value)}
                    options={[
                      { value: 'Aadhaar', label: 'Aadhaar' },
                      { value: 'Voter ID', label: 'Voter ID' },
                      { value: 'PAN', label: 'PAN' },
                      { value: 'Other', label: 'Other' },
                    ]}
                  />
                  <Input
                    label="Identity reference"
                    value={member.identityReference}
                    onChange={(e) => updateMember(index, 'identityReference', e.target.value)}
                    placeholder="ID number"
                  />
                  <Input
                    label="Address"
                    value={member.address}
                    onChange={(e) => updateMember(index, 'address', e.target.value)}
                  />
                </div>
              </div>
            ))}
            <label className="consent-row">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              Confirm every person has agreed to use these details for this service request
            </label>
          </Card>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <Button type="submit" isLoading={isSubmitting}>
            {members.length > 0 ? 'Register & issue token' : 'Register Visitor'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
