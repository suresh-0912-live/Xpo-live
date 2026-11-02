import { useEffect, useState } from 'react'
import BottomNavigation from '../components/BottomNavigation.jsx'
import MobileHeader from '../components/MobileHeader.jsx'
import { request } from '../api/auth.js'
import { navItemsFor } from '../data/dashboardData.js'
import '../dashboard.css'
import './Notifications.css'

export default function Notifications({ onNavigate, onUnreadChange }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    request('/notifications?page=1&pageSize=50')
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
        onUnreadChange?.(result.unreadCount || 0)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [reloadKey, onUnreadChange])

  useEffect(() => {
    const refreshOnFocus = () => setReloadKey((key) => key + 1)
    window.addEventListener('focus', refreshOnFocus)
    return () => window.removeEventListener('focus', refreshOnFocus)
  }, [])

  async function markRead(notificationId) {
    setBusyId(notificationId)
    try {
      await request(`/notifications/${notificationId}/read`, { method: 'POST' })
      setData((current) => current && ({
        ...current,
        unreadCount: Math.max(0, current.unreadCount - 1),
        notifications: current.notifications.map((row) => row.notificationId === notificationId ? { ...row, status: 'read' } : row),
      }))
      onUnreadChange?.(Math.max(0, (data?.unreadCount || 0) - 1))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function markAllRead() {
    setBusyId('all')
    try {
      await request('/notifications/read-all', { method: 'POST' })
      setData((current) => current && ({
        ...current,
        unreadCount: 0,
        notifications: current.notifications.map((row) => ({ ...row, status: 'read' })),
      }))
      onUnreadChange?.(0)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const items = navItemsFor('home').map((item) => ({ ...item, active: false }))

  return (
    <div className="shell">
      <MobileHeader showAvatar={false} hasNotification={Boolean(data?.unreadCount)} onNotifications={() => setReloadKey((key) => key + 1)} />
      <main className="screen">
        <section className="inbox__head">
          <div>
            <h1 className="inbox__title">Notifications</h1>
            <p className="inbox__sub">Account messages and updates</p>
          </div>
          <div className="inbox__controls">
            <button type="button" className="inbox__icon" aria-label="Refresh notifications" title="Refresh" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
              ↻
            </button>
            <button type="button" className="inbox__text-button" onClick={markAllRead} disabled={!data?.unreadCount || busyId !== null}>
              Mark all read
            </button>
          </div>
        </section>

        {error && <p className="inbox__error" role="alert">{error}</p>}
        {loading && <p className="inbox__state">Loading notifications…</p>}
        {!loading && !error && data?.notifications.length === 0 && <p className="inbox__state">You are all caught up.</p>}

        {data?.notifications.length > 0 && (
          <section className="inbox__list" aria-label="Notification history">
            {data.notifications.map((row) => (
              <article key={row.id} className={`inbox__item${row.status === 'sent' ? ' inbox__item--unread' : ''}`}>
                <span className="inbox__mark" aria-hidden="true">{row.status === 'sent' ? '' : '✓'}</span>
                <div className="inbox__copy">
                  <div className="inbox__item-head">
                    <h2>{row.notification.title}</h2>
                    <time dateTime={row.deliveredAt || row.notification.createdAt}>
                      {new Date(row.deliveredAt || row.notification.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <p>{row.notification.body}</p>
                  <span className="inbox__type">{row.notification.type.replaceAll('_', ' ')}</span>
                </div>
                {row.status === 'sent' && (
                  <button type="button" className="inbox__read-button" onClick={() => markRead(row.notificationId)} disabled={busyId !== null}>
                    {busyId === row.notificationId ? 'Saving…' : 'Mark read'}
                  </button>
                )}
              </article>
            ))}
          </section>
        )}
      </main>
      <BottomNavigation items={items} onSelect={onNavigate} />
    </div>
  )
}
