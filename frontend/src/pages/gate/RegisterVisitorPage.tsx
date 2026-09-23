import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Textarea } from '../../components/Textarea';
import { Button } from '../../components/Button';
import { CameraCapture } from '../../components/CameraCapture';
import { MobileCameraConnect } from '../../components/MobileCameraConnect';
import { ProgressSteps, type ProgressStep } from '../../components/ProgressSteps';
import { ActionBar } from '../../components/ActionBar';
import { SuccessState } from '../../components/SuccessState';
import { FormErrorBanner } from '../../components/ErrorState';
import { LoadingOverlay, SkeletonField } from '../../components/LoadingSpinner';
import { useCaptureSession } from '../../hooks/useCaptureSession';
import { useVisitReasons } from '../../hooks/useMasterData';
import { visitorService } from '../../services/visitorService';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';
import { PRIORITIES, VISITOR_TYPES } from '../../utils/constants';
import { IconUser, IconMobile, IconMapPin, IconBuilding, IconFlag } from '../../components/icons';
import type { GroupMember, Priority, VisitorType } from '../../types';
import './RegisterVisitorPage.css';

const EMPTY_MEMBER: GroupMember = { name: '', mobile: '', identityType: 'Aadhaar', identityReference: '', address: '' };

/** Matches the backend limit on `purpose` - a display aid, not a second rule. */
const PURPOSE_LIMIT = 2000;

const STEPS: ProgressStep[] = [
  { id: '01', label: 'Identity' },
  { id: '02', label: 'Visitor details' },
  { id: '03', label: 'Visit information' },
  { id: '04', label: 'Review' },
];

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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [groupSize, setGroupSize] = useState(1);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [consent, setConsent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  /** Set from the existing register response; drives the confirmation panel. */
  const [registeredCode, setRegisteredCode] = useState<string | null>(null);

  // A photo arriving from a phone fills the main identity slot when it is still
  // empty; otherwise it waits in the panel for the operator to pick it, so an
  // incoming shot can never silently overwrite one already accepted.
  const handleIncomingPhoto = useCallback((image: { url: string }) => {
    setDuplicateNotice(null);
    setPhotoUrl((current) => current ?? image.url);
  }, []);

  // A duplicate from any device must be visible even when the mobile-camera
  // panel is closed, so it raises a toast as well as the in-panel banner.
  const handleDuplicatePhoto = useCallback(
    (payload: { message: string }) => {
      setDuplicateNotice(payload.message);
      showToast(`❌ Duplicate Photo — ${payload.message}`, 'error');
    },
    [showToast],
  );

  const capture = useCaptureSession({
    onImage: handleIncomingPhoto,
    onDuplicate: handleDuplicatePhoto,
  });

  const reasons = useVisitReasons(visitorType);
  const reasonOptions = useMemo(
    () => (reasons.data || []).map((r) => ({ value: r.reason, label: r.reason })),
    [reasons.data],
  );

  /* ------------------------------------------------------------------ steps */
  // Purely reflective: which sections already hold enough data. No navigation
  // is gated on this - every field remains on the page and submits together.
  const identityDone = !!photoUrl;
  const detailsDone = name.trim().length > 0 && mobile.trim().length > 0;
  const visitDone = purpose.trim().length > 0;

  const completedSteps = [
    identityDone ? 0 : -1,
    detailsDone ? 1 : -1,
    visitDone ? 2 : -1,
  ].filter((index) => index >= 0);

  const currentStep = !identityDone ? 0 : !detailsDone ? 1 : !visitDone ? 2 : 3;

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

  /** Reset to a blank form so the operator can register the next visitor. */
  function registerAnother() {
    setRegisteredCode(null);
    setName('');
    setMobile('');
    setAddress('');
    setConstituency('');
    setVisitorType('General Public');
    setReason('');
    setPurpose('');
    setPersonToMeet('');
    setPriority('NORMAL');
    setPhotoUrl(null);
    setGroupSize(1);
    setMembers([]);
    setConsent(false);
    setFormError(null);
    setFieldErrors({});
    setDuplicateNotice(null);
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
        photoUrl: photoUrl || undefined,
        purpose,
        reason: reason || undefined,
        personToMeet: personToMeet || undefined,
        priority,
        groupSize,
        groupMembers: groupSize > 1 ? members : undefined,
      });
      showToast(`Visitor registered. Token ${result.requestCode} sent to the PA queue.`, 'success');
      setRegisteredCode(result.requestCode);
    } catch (error) {
      setFormError(getErrorMessage(error));
      setFieldErrors(getFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  /* --------------------------------------------------------------- success */

  if (registeredCode) {
    return (
      <div className="register-page">
        <PageHeader
          title="Register a Visitor"
          description="Create a visitor record and verify identity before entry."
          status={<span className="status-pill status-pill-success">Registration complete</span>}
        />
        <Card>
          <SuccessState
            title="Visitor registered successfully"
            referenceLabel="Token"
            reference={registeredCode}
            description="The request has been sent to the PA queue. The visitor can be directed to wait."
          >
            <Button type="button" onClick={registerAnother}>
              Register another visitor
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/gate/visitors/today')}>
              View today's visitors
            </Button>
          </SuccessState>
        </Card>
      </div>
    );
  }

  /* ------------------------------------------------------------------ form */

  return (
    <div className="register-page">
      <PageHeader
        title="Register a Visitor"
        description="Create a visitor record and verify identity before entry."
        status={
          <span className="status-pill status-pill-info status-pill-live">Registration in progress</span>
        }
      />

      <ProgressSteps steps={STEPS} currentIndex={currentStep} completed={completedSteps} />

      <form onSubmit={handleSubmit} noValidate className="register-form">
        {isSubmitting && <LoadingOverlay label="Registering visitor…" />}

        <Card
          step="01"
          title="Identity verification"
          subtitle="Capture the visitor's photo with consent, before entering their details."
          status={
            <span className={`status-pill ${photoUrl ? 'status-pill-success' : ''}`.trim()}>
              {photoUrl ? 'Photo captured' : 'Awaiting photo'}
            </span>
          }
          className="section-spacing"
          enterDelay={0}
        >
          <div className="identity-layout">
            <CameraCapture
              value={photoUrl}
              onCapture={setPhotoUrl}
              onClear={() => setPhotoUrl(null)}
              label="The photo is stored against this visit record and used for identity verification only."
              sessionId={capture.sessionId}
            />

            <div className="identity-aside">
              <div>
                <h3 className="identity-aside-title">Other capture options</h3>
                <p className="identity-aside-text">
                  Use a phone as an extra camera, or pick a USB camera from the device list in the panel.
                </p>
                <MobileCameraConnect
                  capture={capture}
                  onUsePhoto={(image) => {
                    setDuplicateNotice(null);
                    setPhotoUrl(image.url);
                  }}
                  duplicateMessage={duplicateNotice}
                />
              </div>

              <div className="identity-tips">
                <h4>For a usable photo</h4>
                <ul>
                  <li>Face the visitor towards the light, not a window behind them.</li>
                  <li>Frame head and shoulders inside the guide oval.</li>
                  <li>Ask the visitor to remove a helmet or face covering.</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        <Card
          step="02"
          title="Visitor information"
          subtitle="Who is visiting, and how to reach them."
          className="section-spacing"
          enterDelay={60}
        >
          {formError && <FormErrorBanner message={formError} />}

          <div className="form-grid-2">
            <Input
              label="Full name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
              placeholder="As printed on the ID"
              icon={<IconUser size={16} />}
            />
            <Input
              label="Mobile number"
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              error={fieldErrors.mobile}
              placeholder="10-digit mobile"
              inputMode="numeric"
              icon={<IconMobile size={16} />}
            />
            <Input
              label="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Optional"
              icon={<IconMapPin size={16} />}
            />
            <Input
              label="District"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              icon={<IconBuilding size={16} />}
            />
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
          </div>
        </Card>

        <Card
          step="03"
          title="Visit details"
          subtitle="Why they are here and who they need to see."
          className="section-spacing"
          enterDelay={120}
        >
          <div className="form-grid-2">
            {/* The reason list depends on visitor type, so it is re-fetched on
                change - a skeleton keeps the row from collapsing meanwhile. */}
            {reasons.isLoading ? (
              <SkeletonField />
            ) : (
              <Select
                label="Reason for visit"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                options={reasonOptions}
                placeholder="Select a reason"
              />
            )}
            <Input
              label="Person to meet"
              value={personToMeet}
              onChange={(e) => setPersonToMeet(e.target.value)}
              placeholder="Optional"
              icon={<IconUser size={16} />}
            />
          </div>

          <Textarea
            label="Purpose / grievance details"
            required
            rows={4}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            error={fieldErrors.purpose}
            placeholder="Briefly describe the purpose of the visit…"
            maxLength={PURPOSE_LIMIT}
            showCount
          />

          <div className="form-grid-2">
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              options={PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
            <Input
              label="Number of persons in this visit"
              type="number"
              min={1}
              max={50}
              value={groupSize}
              onChange={(e) => updateGroupSize(Number(e.target.value))}
              icon={<IconFlag size={16} />}
              hint={
                groupSize > 1
                  ? `Group visit — ${groupSize} people. One meeting request will be created.`
                  : 'Increase this to register a group visit.'
              }
            />
          </div>
        </Card>

        {members.length > 0 && (
          <Card
            step="04"
            title="Accompanying people"
            subtitle={`Capture the remaining ${members.length} ${members.length === 1 ? 'person' : 'people'} in this group.`}
            className="section-spacing"
            enterDelay={160}
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
                    sessionId={capture.sessionId}
                    value={member.photoUrl}
                    onCapture={(url) => updateMember(index, 'photoUrl', url)}
                    onClear={() => updateMember(index, 'photoUrl', '')}
                  />
                  <div className="form-grid-2 group-member-fields">
                    <Input
                      label="Full name"
                      required
                      value={member.name}
                      onChange={(e) => updateMember(index, 'name', e.target.value)}
                      icon={<IconUser size={16} />}
                    />
                    <Input
                      label="Mobile number"
                      value={member.mobile}
                      onChange={(e) => updateMember(index, 'mobile', e.target.value)}
                      inputMode="numeric"
                      icon={<IconMobile size={16} />}
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
                      icon={<IconMapPin size={16} />}
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
                onChange={(e) => setConsent(e.target.checked)}
              />
              Confirm every person has agreed to use these details for this service request
            </label>
          </Card>
        )}

        <ActionBar
          note={
            photoUrl
              ? 'Identity photo captured. Review the details before registering.'
              : 'A photo is recommended before registering this visitor.'
          }
        >
          <Button type="button" variant="secondary" onClick={() => navigate(-1)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isSubmitting
              ? 'Registering visitor…'
              : members.length > 0
                ? 'Register & issue token'
                : 'Register visitor'}
          </Button>
        </ActionBar>
      </form>
    </div>
  );
}
