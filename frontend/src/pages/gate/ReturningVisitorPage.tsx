import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { visitorService } from '../../services/visitorService';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime } from '../../utils/formatters';
import type { Visitor } from '../../types';

export function ReturningVisitorPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [mobile, setMobile] = useState('');
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [purpose, setPurpose] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleScan(event: FormEvent) {
    event.preventDefault();
    if (!mobile.trim()) return;
    setError(null);
    setIsSearching(true);
    setSearched(false);
    try {
      const found = await visitorService.lookupByMobile(mobile.trim());
      setVisitor(found);
    } catch (err) {
      setVisitor(null);
      setError(getErrorMessage(err));
    } finally {
      setIsSearching(false);
      setSearched(true);
    }
  }

  async function handleCreateRequest() {
    if (!visitor || !purpose.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await visitorService.register({
        visitorId: visitor.id,
        name: visitor.name,
        mobile: visitor.mobile,
        purpose: purpose.trim(),
      });
      showToast(`New visit request ${result.requestCode} submitted for ${visitor.name}.`);
      navigate('/gate/visitors/today');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Identify a returning visitor"
        description="Look up an existing visitor by mobile number to reuse their profile for today's visit."
      />

      <Card title="Find visitor" className="section-spacing">
        <form onSubmit={handleScan} className="form-grid-2">
          <Input
            label="Mobile number"
            required
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="10-digit mobile"
          />
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1rem' }}>
            <Button type="submit" isLoading={isSearching}>
              Search
            </Button>
          </div>
        </form>
      </Card>

      {error && <div className="form-alert-error">{error}</div>}

      {searched && !visitor && !error && (
        <EmptyState title="No matching visitor" description="Register this person as a new visitor instead." />
      )}

      {visitor && (
        <Card title="Visitor found">
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px' }}>
              <h3 style={{ marginBottom: '0.25rem' }}>{visitor.name}</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                {visitor.mobile} · {visitor.constituency || 'Constituency not recorded'}
              </p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Previous visits: <strong>{visitor.previousVisits ?? 0}</strong>
              </p>
              {visitor.lastVisit && (
                <p style={{ fontSize: '0.85rem' }}>
                  Last purpose: {visitor.lastVisit.purpose} ({formatDateTime(visitor.lastVisit.requested_at)})
                </p>
              )}
            </div>
            <div style={{ flex: '1 1 280px' }}>
              <Textarea
                label="Purpose of today's visit"
                required
                rows={3}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
              <Button onClick={handleCreateRequest} isLoading={isSubmitting} disabled={!purpose.trim()}>
                Create new visit request
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
