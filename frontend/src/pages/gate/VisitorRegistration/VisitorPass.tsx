import { QrCode } from '../../../components/QrCode';
import { IconUser } from '../../../components/icons';
import type { VisitorPass as VisitorPassData } from '../../../types';
import './VisitorPass.css';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function Field({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="pass-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * The printable visitor pass.
 *
 * Every value comes from the registration record returned by the API - nothing
 * on this card is hard-coded or sampled. The markup is the same for screen and
 * print; `VisitorPass.css` carries the print rules that strip the surrounding
 * application chrome.
 */
export function VisitorPass({ pass }: { pass: VisitorPassData }) {
  return (
    <article className="visitor-pass" aria-label={`Visitor pass ${pass.tokenNumber}`}>
      <header className="pass-header">
        <div className="pass-brand">
          <span className="pass-brand-mark">VT</span>
          <div>
            <strong>{pass.officeName}</strong>
            <span>{pass.officeSubtitle}</span>
          </div>
        </div>
        <span className="pass-kind">Visitor Pass</span>
      </header>

      <div className="pass-body">
        <div className="pass-identity">
          <div className="pass-photo">
            {pass.photoUrl ? (
              <img src={pass.photoUrl} alt={`Photo of ${pass.fullName}`} />
            ) : (
              <span className="pass-photo-empty" aria-label="No photo captured">
                <IconUser size={34} />
              </span>
            )}
          </div>

          <div className="pass-identity-text">
            <h3 className="pass-name">{pass.fullName}</h3>
            <div className="pass-token">
              <span>Token</span>
              <strong>{pass.tokenNumber}</strong>
            </div>
            <div className="pass-visitor-id">
              Visitor ID <strong>{pass.visitorCode}</strong>
            </div>
            <span className="pass-status">{pass.queueStatus}</span>
          </div>
        </div>

        <dl className="pass-fields">
          <Field label="Mobile" value={pass.mobileNumber} />
          <Field label="District" value={pass.district} />
          <Field label="Constituency" value={pass.constituency} />
          <Field label="Visitor type" value={pass.visitorType} />
          <Field label="Person to meet" value={pass.personToMeet} />
          <Field label="Reason for visit" value={pass.reason} />
          <Field label="Persons" value={pass.numberOfPersons} />
          <Field label="Priority" value={pass.priority} />
          <Field label="Visit date" value={formatDate(pass.registeredAt)} />
          <Field label="Registration time" value={formatTime(pass.registeredAt)} />
        </dl>

        <div className="pass-verify">
          <QrCode value={pass.verifyUrl} size={104} alt={`QR code verifying pass ${pass.tokenNumber}`} />
          <p>
            Scan to verify this pass.
            <span>Carry a photo ID. Valid for this visit only.</span>
          </p>
        </div>
      </div>

      <footer className="pass-footer">
        <span>{pass.officeName} · Visitor Pass</span>
        <span>{pass.tokenNumber}</span>
      </footer>
    </article>
  );
}
