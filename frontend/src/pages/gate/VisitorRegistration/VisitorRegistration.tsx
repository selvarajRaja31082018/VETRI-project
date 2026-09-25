import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/Button';
import { ActionBar } from '../../../components/ActionBar';
import { FormErrorBanner } from '../../../components/ErrorState';
import { LoadingOverlay, LoadingSpinner } from '../../../components/LoadingSpinner';
import { RegistrationStepper, type WizardStep } from './RegistrationStepper';
import { IdentityStep } from './IdentityStep';
import { VisitorDetailsStep, type VisitorDetailsValues } from './VisitorDetailsStep';
import { VisitDetailsStep, type VisitDetailsValues } from './VisitDetailsStep';
import { ReviewSummary } from './ReviewSummary';
import { VisitorPass } from './VisitorPass';
import { EmailPassModal } from './EmailPassModal';
import { useCaptureSession } from '../../../hooks/useCaptureSession';
import { useVisitReasons } from '../../../hooks/useMasterData';
import { visitorService } from '../../../services/visitorService';
import { visitorPassService } from '../../../services/visitorPassService';
import { useToast } from '../../../hooks/useToast';
import { getErrorMessage, getFieldErrors } from '../../../utils/errors';
import type { CapturedImage, GroupMember, VisitorPass as VisitorPassData } from '../../../types';
import './VisitorRegistration.css';

const EMPTY_MEMBER: GroupMember = { name: '', mobile: '', identityType: 'Aadhaar', identityReference: '', address: '' };

const STEPS: WizardStep[] = [
  { id: '01', label: 'Identity' },
  { id: '02', label: 'Visitor details' },
  { id: '03', label: 'Visit details' },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Visitor registration.
 *
 * The form is split across three short steps so no single screen is long, but
 * it remains ONE form submitted in ONE request: the existing
 * `visitorService.register` call, payload and validation rules are unchanged.
 * Step navigation only decides which fields are visible.
 *
 * On success the screen becomes the visitor pass, built from the pass endpoint
 * so every value shown is the stored record rather than local form state.
 */
export function VisitorRegistration() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);

  const [details, setDetails] = useState<VisitorDetailsValues>({
    name: '',
    mobile: '',
    email: '',
    address: '',
    district: 'Chennai',
    constituency: '',
    visitorType: 'General Public',
  });

  const [visit, setVisit] = useState<VisitDetailsValues>({
    reason: '',
    personToMeet: '',
    purpose: '',
    priority: 'NORMAL',
    groupSize: 1,
  });

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [consent, setConsent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  /* Result state - the pass replaces the form once registration succeeds. */
  const [pass, setPass] = useState<VisitorPassData | null>(null);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [isLoadingPass, setIsLoadingPass] = useState(false);

  // A photo arriving from a phone fills the identity slot when it is still
  // empty; otherwise it waits in the panel so an incoming shot can never
  // silently overwrite one already accepted.
  const handleIncomingPhoto = useCallback((image: { url: string }) => {
    setDuplicateNotice(null);
    setPhotoUrl((current) => current ?? image.url);
  }, []);

  const handleDuplicatePhoto = useCallback(
    (payload: { message: string }) => {
      setDuplicateNotice(payload.message);
      showToast(`Duplicate photo — ${payload.message}`, 'error');
    },
    [showToast],
  );

  const capture = useCaptureSession({
    onImage: handleIncomingPhoto,
    onDuplicate: handleDuplicatePhoto,
  });

  const reasons = useVisitReasons(details.visitorType);
  const reasonOptions = useMemo(
    () => (reasons.data || []).map((r) => ({ value: r.reason, label: r.reason })),
    [reasons.data],
  );

  /* ----------------------------------------------------------- field edits */

  const updateDetails = useCallback(
    <K extends keyof VisitorDetailsValues>(field: K, value: VisitorDetailsValues[K]) => {
      setDetails((prev) => ({ ...prev, [field]: value }));
      setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
      // Changing visitor type re-fetches the reason list, so the old choice
      // may no longer exist.
      if (field === 'visitorType') setVisit((prev) => ({ ...prev, reason: '' }));
    },
    [],
  );

  const updateVisit = useCallback(
    <K extends keyof VisitDetailsValues>(field: K, value: VisitDetailsValues[K]) => {
      setVisit((prev) => ({ ...prev, [field]: value }));
      setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
    },
    [],
  );

  function updateGroupSize(value: number) {
    const size = Math.max(1, Math.min(50, value || 1));
    setVisit((prev) => ({ ...prev, groupSize: size }));
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

  /* ------------------------------------------------------------ navigation */

  /**
   * Client-side gate for moving between steps. It mirrors the rules the
   * backend already enforces so the operator is not sent to the last step only
   * to be bounced back; the server remains the authority.
   */
  function validateStep(index: number): Record<string, string> {
    const errors: Record<string, string> = {};

    if (index === 1) {
      if (!details.name.trim()) errors.name = 'Enter the visitor’s full name.';
      if (!details.mobile.trim()) errors.mobile = 'Enter a mobile number.';
      else if (!/^\d{10}$/.test(details.mobile.trim())) errors.mobile = 'Enter a 10-digit mobile number.';
      if (details.email.trim() && !EMAIL_PATTERN.test(details.email.trim())) {
        errors.email = 'Enter a valid email address.';
      }
    }

    if (index === 2) {
      if (!visit.purpose.trim()) errors.purpose = 'Describe the purpose of the visit.';
      if (visit.groupSize > 1 && !consent) {
        errors.consent = 'Confirm every accompanying person has agreed to share their details.';
      }
    }

    return errors;
  }

  function goToStep(next: number) {
    setFormError(null);
    // Moving forward validates the step being left; moving back never blocks.
    if (next > step) {
      const errors = validateStep(step);
      if (Object.keys(errors).length) {
        setFieldErrors(errors);
        setFormError(errors.consent || 'Check the highlighted fields before continuing.');
        return;
      }
    }
    setFieldErrors({});
    setStep(next);
    setFurthestStep((prev) => Math.max(prev, next));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------------------------------------------------------- submit */

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors = validateStep(2);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setFormError(errors.consent || 'Check the highlighted fields before registering.');
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const result = await visitorService.register({
        name: details.name,
        mobile: details.mobile,
        email: details.email || undefined,
        address: details.address || undefined,
        district: details.district || undefined,
        constituency: details.constituency || undefined,
        visitorType: details.visitorType,
        photoUrl: photoUrl || undefined,
        purpose: visit.purpose,
        reason: visit.reason || undefined,
        personToMeet: visit.personToMeet || undefined,
        priority: visit.priority,
        groupSize: visit.groupSize,
        groupMembers: visit.groupSize > 1 ? members : undefined,
      });

      showToast(`Visitor registered. Token ${result.requestCode} sent to the PA queue.`, 'success');

      // The pass is read back from the server so the card shows the stored
      // record - including the token, timestamp and queue status the backend
      // assigned - rather than echoing local form state.
      setIsLoadingPass(true);
      try {
        const passResponse = await visitorPassService.getPass(result.requestId);
        setPass(passResponse.pass);
        setEmailAvailable(passResponse.emailAvailable);
      } catch (passError) {
        // Registration succeeded; only the pass view failed. Say so plainly
        // instead of implying the visitor was not registered.
        setFormError(
          `Visitor registered as ${result.requestCode}, but the pass could not be loaded: ${getErrorMessage(passError)}`,
        );
      } finally {
        setIsLoadingPass(false);
      }
    } catch (error) {
      const serverFieldErrors = getFieldErrors(error);
      setFormError(getErrorMessage(error));
      setFieldErrors(serverFieldErrors);
      // Send the operator to the step that holds the rejected field.
      if (serverFieldErrors.name || serverFieldErrors.mobile || serverFieldErrors.email) setStep(1);
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Clear everything and return to step 1 without reloading the app. */
  function registerAnother() {
    setPass(null);
    setEmailAvailable(false);
    setIsEmailOpen(false);
    setStep(0);
    setFurthestStep(0);
    setDetails({
      name: '',
      mobile: '',
      email: '',
      address: '',
      district: 'Chennai',
      constituency: '',
      visitorType: 'General Public',
    });
    setVisit({ reason: '', personToMeet: '', purpose: '', priority: 'NORMAL', groupSize: 1 });
    setPhotoUrl(null);
    setMembers([]);
    setConsent(false);
    setFormError(null);
    setFieldErrors({});
    setDuplicateNotice(null);
    // A fresh capture session, so photos from the previous visitor cannot
    // arrive against this one.
    void capture.start();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ pass */

  if (pass) {
    return (
      <div className="register-page">
        <PageHeader
          title="Registration complete"
          description={`${pass.fullName} has been registered and sent to the PA queue.`}
          status={<span className="status-pill status-pill-success">Token {pass.tokenNumber}</span>}
        />

        <div className="pass-screen">
          <VisitorPass pass={pass} />

          <div className="pass-actions">
            <div className="pass-actions-group">
              <Button type="button" onClick={() => window.print()}>
                Print pass
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEmailOpen(true)}
                disabled={!emailAvailable}
                title={emailAvailable ? undefined : 'Email is not configured on this server'}
              >
                Email pass
              </Button>
              {/*
                No PDF library is bundled, and adding one purely for this would
                be a large dependency for a page the browser can already export.
                The print dialog's "Save as PDF" destination produces the same
                A4 layout, so it is offered explicitly rather than hidden.
              */}
              <Button type="button" variant="secondary" onClick={() => window.print()}>
                Save as PDF
              </Button>
            </div>

            {!emailAvailable && (
              <p className="pass-actions-note">
                Emailing a pass needs SMTP configured on the server.
              </p>
            )}

            <div className="pass-actions-group">
              <Button type="button" variant="secondary" onClick={registerAnother}>
                Register another visitor
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate('/gate/visitors/today')}>
                View today's visitors
              </Button>
            </div>
          </div>
        </div>

        <EmailPassModal
          isOpen={isEmailOpen}
          onClose={() => setIsEmailOpen(false)}
          requestId={pass.requestId}
          tokenNumber={pass.tokenNumber}
          defaultEmail={pass.email}
        />
      </div>
    );
  }

  /* ------------------------------------------------------------------ form */

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="register-page">
      <PageHeader
        title="Register a Visitor"
        description="Create a visitor record and verify identity before entry."
        status={<span className="status-pill status-pill-info status-pill-live">Registration in progress</span>}
      />

      <RegistrationStepper steps={STEPS} current={step} furthest={furthestStep} onSelect={goToStep} />

      <form onSubmit={handleSubmit} noValidate className="register-form">
        {(isSubmitting || isLoadingPass) && (
          <LoadingOverlay label={isSubmitting ? 'Registering visitor…' : 'Preparing visitor pass…'} />
        )}

        {formError && <FormErrorBanner message={formError} />}

        {step === 0 && (
          <IdentityStep
            photoUrl={photoUrl}
            onCapture={setPhotoUrl}
            onClear={() => setPhotoUrl(null)}
            capture={capture}
            duplicateNotice={duplicateNotice}
            onUseMobilePhoto={(image: CapturedImage) => {
              setDuplicateNotice(null);
              setPhotoUrl(image.url);
            }}
          />
        )}

        {step === 1 && (
          <VisitorDetailsStep values={details} errors={fieldErrors} onChange={updateDetails} />
        )}

        {step === 2 && (
          <>
            <VisitDetailsStep
              values={visit}
              errors={fieldErrors}
              onChange={updateVisit}
              reasonOptions={reasonOptions}
              reasonsLoading={reasons.isLoading}
              members={members}
              onMemberChange={updateMember}
              onGroupSizeChange={updateGroupSize}
              consent={consent}
              onConsentChange={setConsent}
              captureSessionId={capture.sessionId}
            />

            <ReviewSummary
              photoUrl={photoUrl}
              items={[
                { label: 'Full name', value: details.name },
                { label: 'Mobile', value: details.mobile },
                { label: 'Email', value: details.email },
                { label: 'District', value: details.district },
                { label: 'Constituency', value: details.constituency },
                { label: 'Visitor type', value: details.visitorType },
                { label: 'Reason', value: visit.reason },
                { label: 'Person to meet', value: visit.personToMeet },
                { label: 'Priority', value: visit.priority },
                { label: 'Persons', value: visit.groupSize },
              ]}
            />
          </>
        )}

        <ActionBar
          note={
            isLastStep
              ? photoUrl
                ? 'Identity photo captured. Review the details before registering.'
                : 'No photo captured. You can still register this visitor.'
              : `Step ${step + 1} of ${STEPS.length}`
          }
        >
          {step === 0 ? (
            <Button type="button" variant="secondary" onClick={() => navigate(-1)} disabled={isSubmitting}>
              Cancel
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => goToStep(step - 1)} disabled={isSubmitting}>
              Back
            </Button>
          )}

          {isLastStep ? (
            <Button type="submit" isLoading={isSubmitting}>
              {isSubmitting ? 'Registering visitor…' : members.length > 0 ? 'Register & issue token' : 'Register visitor'}
            </Button>
          ) : (
            <Button type="button" onClick={() => goToStep(step + 1)}>
              Continue
            </Button>
          )}
        </ActionBar>
      </form>

      {isLoadingPass && !isSubmitting && <LoadingSpinner label="Preparing visitor pass" />}
    </div>
  );
}
