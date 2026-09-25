import { useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorState } from '../../components/ErrorState';
import { useAsync } from '../../hooks/useAsync';
import { visitorPassService } from '../../services/visitorPassService';
import { IconUser } from '../../components/icons';
import './VerifyPassPage.css';

/**
 * Landing page for a scanned visitor pass.
 *
 * The QR carries only a request id, so this page fetches the verification
 * payload behind the staff session. It shows just enough to confirm the person
 * holding the pass is the person it was issued to - no address, no grievance
 * text - and flags a restricted visitor prominently.
 */
export function VerifyPassPage() {
  const { id } = useParams();
  const requestId = Number(id);
  const state = useAsync(() => visitorPassService.verify(requestId), [requestId]);

  return (
    <div className="verify-page">
      <PageHeader title="Verify visitor pass" description="Scanned pass details for gate and desk staff." />

      <Card>
        {state.isLoading && <LoadingSpinner label="Looking up this pass" />}

        {!state.isLoading && state.error && (
          <ErrorState
            title="Pass not found"
            message={state.error}
            onRetry={state.reload}
          />
        )}

        {!state.isLoading && state.data && (
          <div className="verify-body">
            {state.data.isRestricted && (
              <div className="verify-restricted" role="alert">
                This visitor is on the restricted list. Follow the escalation procedure.
              </div>
            )}

            <div className="verify-identity">
              <div className="verify-photo">
                {state.data.photoUrl ? (
                  <img src={state.data.photoUrl} alt={`Photo of ${state.data.fullName}`} />
                ) : (
                  <span aria-label="No photo on this pass">
                    <IconUser size={32} />
                  </span>
                )}
              </div>
              <div>
                <h2 className="verify-name">{state.data.fullName}</h2>
                <div className="verify-token">{state.data.tokenNumber}</div>
                <span className="status-pill status-pill-success">{state.data.queueStatus}</span>
              </div>
            </div>

            <dl className="verify-fields">
              <div>
                <dt>Visitor ID</dt>
                <dd>{state.data.visitorCode}</dd>
              </div>
              <div>
                <dt>Visitor type</dt>
                <dd>{state.data.visitorType || '—'}</dd>
              </div>
              <div>
                <dt>District</dt>
                <dd>{state.data.district || '—'}</dd>
              </div>
              <div>
                <dt>Person to meet</dt>
                <dd>{state.data.personToMeet || '—'}</dd>
              </div>
              <div>
                <dt>Persons</dt>
                <dd>{state.data.numberOfPersons}</dd>
              </div>
              <div>
                <dt>Registered</dt>
                <dd>{new Date(state.data.registeredAt).toLocaleString('en-GB')}</dd>
              </div>
            </dl>
          </div>
        )}
      </Card>
    </div>
  );
}
