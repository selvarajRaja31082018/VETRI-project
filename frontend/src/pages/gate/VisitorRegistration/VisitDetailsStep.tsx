import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { Select } from '../../../components/Select';
import { Textarea } from '../../../components/Textarea';
import { CameraCapture } from '../../../components/CameraCapture';
import { SkeletonField } from '../../../components/LoadingSpinner';
import { IconUser, IconMobile, IconMapPin, IconFlag } from '../../../components/icons';
import { PRIORITIES } from '../../../utils/constants';
import type { GroupMember, Priority } from '../../../types';

/** Matches the backend limit on `purpose` - a display aid, not a second rule. */
export const PURPOSE_LIMIT = 2000;

export interface VisitDetailsValues {
  reason: string;
  personToMeet: string;
  purpose: string;
  priority: Priority;
  groupSize: number;
}

/** Step 3 - why they are here, plus any accompanying people. */
export function VisitDetailsStep({
  values,
  errors,
  onChange,
  reasonOptions,
  reasonsLoading,
  members,
  onMemberChange,
  onGroupSizeChange,
  consent,
  onConsentChange,
  captureSessionId,
}: {
  values: VisitDetailsValues;
  errors: Record<string, string>;
  onChange: <K extends keyof VisitDetailsValues>(field: K, value: VisitDetailsValues[K]) => void;
  reasonOptions: Array<{ value: string; label: string }>;
  reasonsLoading: boolean;
  members: GroupMember[];
  onMemberChange: (index: number, field: keyof GroupMember, value: string) => void;
  onGroupSizeChange: (value: number) => void;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  captureSessionId: string | null;
}) {
  return (
    <>
      <Card
        step="03"
        title="Visit details"
        subtitle="Why they are here and who they need to see."
        className="section-spacing"
        enterDelay={0}
      >
        <div className="form-grid-2">
          {/* The reason list depends on visitor type and is re-fetched on
              change; a skeleton keeps the row from collapsing meanwhile. */}
          {reasonsLoading ? (
            <SkeletonField />
          ) : (
            <Select
              label="Reason for visit"
              required
              value={values.reason}
              onChange={(e) => onChange('reason', e.target.value)}
              options={reasonOptions}
              placeholder="Select a reason"
              error={errors.reason}
            />
          )}
          <Input
            label="Person to meet"
            value={values.personToMeet}
            onChange={(e) => onChange('personToMeet', e.target.value)}
            placeholder="Optional"
            icon={<IconUser size={16} />}
            autoComplete="off"
          />
        </div>

        <Textarea
          label="Purpose / grievance details"
          required
          rows={4}
          value={values.purpose}
          onChange={(e) => onChange('purpose', e.target.value)}
          error={errors.purpose}
          placeholder="Briefly describe the purpose of the visit…"
          maxLength={PURPOSE_LIMIT}
          showCount
        />

        <div className="form-grid-2">
          <Select
            label="Priority"
            value={values.priority}
            onChange={(e) => onChange('priority', e.target.value as Priority)}
            options={PRIORITIES.map((p) => ({ value: p, label: p }))}
          />
          <Input
            label="Number of persons in this visit"
            type="number"
            min={1}
            max={50}
            value={values.groupSize}
            onChange={(e) => onGroupSizeChange(Number(e.target.value))}
            icon={<IconFlag size={16} />}
            hint={
              values.groupSize > 1
                ? `Group visit — ${values.groupSize} people. One meeting request will be created.`
                : 'Increase this to register a group visit.'
            }
          />
        </div>
      </Card>

      {members.length > 0 && (
        <Card
          title="Accompanying people"
          subtitle={`Capture the remaining ${members.length} ${members.length === 1 ? 'person' : 'people'} in this group.`}
          className="section-spacing"
          enterDelay={60}
        >
          {members.map((member, index) => (
            <div key={index} className="group-member-block">
              <div className="group-member-head">
                <span className="group-member-index">{index + 2}</span>
                <span className="group-member-title">Person {index + 2}</span>
              </div>
              <div className="group-member-body">
                <CameraCapture
                  size="small"
                  sessionId={captureSessionId}
                  value={member.photoUrl}
                  onCapture={(url) => onMemberChange(index, 'photoUrl', url)}
                  onClear={() => onMemberChange(index, 'photoUrl', '')}
                />
                <div className="form-grid-2 group-member-fields">
                  <Input
                    label="Full name"
                    required
                    value={member.name}
                    onChange={(e) => onMemberChange(index, 'name', e.target.value)}
                    icon={<IconUser size={16} />}
                    autoComplete="off"
                  />
                  <Input
                    label="Mobile number"
                    value={member.mobile}
                    onChange={(e) => onMemberChange(index, 'mobile', e.target.value)}
                    inputMode="numeric"
                    icon={<IconMobile size={16} />}
                    autoComplete="off"
                  />
                  <Select
                    label="Identity type"
                    value={member.identityType}
                    onChange={(e) => onMemberChange(index, 'identityType', e.target.value)}
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
                    onChange={(e) => onMemberChange(index, 'identityReference', e.target.value)}
                    placeholder="ID number"
                    autoComplete="off"
                  />
                  <Input
                    label="Address"
                    value={member.address}
                    onChange={(e) => onMemberChange(index, 'address', e.target.value)}
                    icon={<IconMapPin size={16} />}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          ))}

          <label className="consent-row">
            <input
              type="checkbox"
              className="field-checkbox"
              checked={consent}
              onChange={(e) => onConsentChange(e.target.checked)}
            />
            Confirm every person has agreed to use these details for this service request
          </label>
        </Card>
      )}
    </>
  );
}
