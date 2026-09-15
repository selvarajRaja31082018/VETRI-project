import { useEffect, useRef, useState } from 'react';
import { useAsync } from '../hooks/useAsync';
import { notificationService, type NotificationRow } from '../services/notificationService';
import { relativeTime } from '../utils/formatters';
import './NotificationBell.css';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, error, reload } = useAsync(() => notificationService.list(), []);
  const [readOverrides, setReadOverrides] = useState<Set<number>>(new Set());

  const items = (data || []).map((n) => (readOverrides.has(n.id) ? { ...n, is_read: 1 as const } : n));
  const unreadCount = items.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  function handleOpen() {
    const next = !isOpen;
    setIsOpen(next);
    if (next) reload();
  }

  async function handleMarkRead(notification: NotificationRow) {
    if (notification.is_read) return;
    setReadOverrides((prev) => new Set(prev).add(notification.id));
    try {
      await notificationService.markRead(notification.id);
    } catch {
      // Non-critical - a stale unread flag isn't worth surfacing an error for.
    }
  }

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="notification-bell-trigger"
        onClick={handleOpen}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && <span className="notification-bell-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-bell-panel" role="menu">
          <div className="notification-bell-header">Notifications</div>
          {isLoading && <div className="notification-bell-empty">Loading...</div>}
          {!isLoading && error && <div className="notification-bell-empty">{error}</div>}
          {!isLoading && !error && items.length === 0 && (
            <div className="notification-bell-empty">You're all caught up.</div>
          )}
          {!isLoading &&
            !error &&
            items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                role="menuitem"
                className={`notification-bell-item ${notification.is_read ? '' : 'is-unread'}`}
                onClick={() => handleMarkRead(notification)}
              >
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                <time>{relativeTime(notification.created_at)}</time>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
