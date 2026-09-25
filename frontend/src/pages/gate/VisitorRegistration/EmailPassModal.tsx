import { useState, type FormEvent } from 'react';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { visitorPassService } from '../../../services/visitorPassService';
import { getErrorMessage } from '../../../utils/errors';
import { IconCheck } from '../../../components/icons';

/** Same shape the backend validates against; catches obvious typos early. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends the visitor pass to an email address.
 *
 * Pre-fills the address captured at registration when there is one. The server
 * is the authority on both the address format and whether mail is configured
 * at all, so a failure here is reported verbatim rather than guessed at.
 */
export function EmailPassModal({
  isOpen,
  onClose,
  requestId,
  tokenNumber,
  defaultEmail,
}: {
  isOpen: boolean;
  onClose: () => void;
  requestId: number;
  tokenNumber: string;
  defaultEmail: string | null;
}) {
  const [email, setEmail] = useState(defaultEmail || '');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function handleClose() {
    if (isSending) return;
    setError(null);
    setSentTo(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }

    setIsSending(true);
    try {
      const result = await visitorPassService.emailPass(requestId, trimmed);
      setSentTo(result.sentTo);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Modal title="Email visitor pass" isOpen={isOpen} onClose={handleClose} width={440}>
      {sentTo ? (
        <div className="email-sent" role="status">
          <span className="email-sent-icon" aria-hidden="true">
            <IconCheck size={22} />
          </span>
          <p>
            Pass <strong>{tokenNumber}</strong> sent to
          </p>
          <strong className="email-sent-address">{sentTo}</strong>
          <div className="email-sent-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSentTo(null);
                setEmail('');
              }}
            >
              Send to another address
            </Button>
            <Button type="button" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="email-modal-intro">
            The visitor pass for token <strong>{tokenNumber}</strong> will be emailed as a formatted message.
          </p>

          <Input
            label="Email address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error || undefined}
            placeholder="visitor@example.com"
            autoComplete="off"
            autoFocus
            hint={defaultEmail ? 'Pre-filled from the visitor record.' : undefined}
          />

          <div className="email-modal-actions">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isSending}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSending}>
              {isSending ? 'Sending…' : 'Send pass'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
