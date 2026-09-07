import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { PriorityBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../hooks/useToast';
import { requestService } from '../../services/requestService';
import { meetingService } from '../../services/meetingService';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime } from '../../utils/formatters';
import './MeetingQueuePage.css';
import type { VisitorRequest } from '../../types';

export function MeetingQueuePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<VisitorRequest | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { data, isLoading, error, reload } = useAsync(
    () => requestService.list({ status: ['ASSIGNED', 'APPROVED', 'WAITING', 'MEETING'], limit: 50 }),
    [],
  );

  async function handleStartMeeting(request: VisitorRequest) {
    setIsStarting(true);
    try {
      const meeting = await meetingService.start(request.id);
      navigate(`/representative/meetings/${meeting.id}`);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Meeting queue" description="Select a visitor to review their complete history before starting the meeting." />

      <div className="meeting-queue-layout">
        <div className="card">
          <div className="card-header">
            <h2>Today's meeting queue</h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {isLoading && <LoadingSpinner />}
            {!isLoading && error && <ErrorState message={error} onRetry={reload} />}
            {!isLoading && !error && (data?.items.length ?? 0) === 0 && (
              <EmptyState title="No visitors waiting" description="Assigned visitors will appear here." />
            )}
            {data?.items.map((row) => (
              <button
                key={row.id}
                type="button"
                className={`queue-row ${selected?.id === row.id ? 'is-selected' : ''}`}
                onClick={() => setSelected(row)}
              >
                <span className="queue-avatar">{row.visitor_name.slice(0, 2).toUpperCase()}</span>
                <span className="queue-info">
                  <strong>{row.visitor_name}</strong>
                  <span>{row.purpose}</span>
                </span>
                <PriorityBadge priority={row.priority} />
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {!selected && (
            <div className="card-body">
              <EmptyState title="Select a visitor" description="Their profile summary and grievance history will appear here." />
            </div>
          )}
          {selected && (
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3>{selected.visitor_name}</h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    {selected.visitor_mobile} · {selected.constituency || 'Constituency not recorded'}
                  </p>
                </div>
                <PriorityBadge priority={selected.priority} />
              </div>

              <div style={{ background: 'var(--color-warning-bg)', padding: '0.85rem', borderRadius: 8, margin: '1rem 0' }}>
                <strong style={{ fontSize: '0.85rem' }}>{selected.reason || 'Grievance'}</strong>
                <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{selected.purpose}</p>
                {selected.group_size > 1 && (
                  <p style={{ fontSize: '0.8rem', marginTop: '0.4rem', color: 'var(--color-text-muted)' }}>
                    Group visit - {selected.group_size} people in this request
                  </p>
                )}
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Requested {formatDateTime(selected.requested_at)}
              </p>

              <Button
                style={{ width: '100%', marginTop: '1rem' }}
                isLoading={isStarting}
                onClick={() => handleStartMeeting(selected)}
              >
                Start Meeting
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
