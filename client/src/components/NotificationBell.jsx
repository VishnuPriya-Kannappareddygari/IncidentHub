import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchNotifications, markAllRead, markRead } from '../api/notifications.js'
import { formatDate } from '../utils/format.js'

export default function NotificationBell() {
  const [state, setState] = useState({ items: [], unread: 0 })
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    fetchNotifications().then((d) => { setState(d); setError(null) }).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  return (
    <div className="bell">
      <button type="button" className="bell-btn" aria-label={`Notifications, ${state.unread} unread`} aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="notification-bell">
        🔔{state.unread > 0 && <span className="bell-count" data-testid="notification-count">{state.unread}</span>}
      </button>
      {open && (
        <div className="bell-panel card" role="dialog" aria-label="Notifications">
          <div className="row between">
            <strong>Notifications</strong>
            <button type="button" disabled={state.unread === 0} onClick={() => markAllRead().then(load)}>Mark all read</button>
          </div>
          {error && <p role="alert" className="error">{error}</p>}
          {state.items.length === 0 && <p className="muted">You're all caught up.</p>}
          <ul className="timeline">
            {state.items.slice(0, 8).map((n) => (
              <li key={n.id} className={n.readAt ? '' : 'unread'}>
                <strong>{n.title}</strong>
                <div className="muted">{n.body}</div>
                <div className="row">
                  <span className="muted">{formatDate(n.createdAt)}</span>
                  {n.incidentId && <Link to={`/incidents/${n.incidentId}`} onClick={() => setOpen(false)}>View #{n.incidentId}</Link>}
                  {!n.readAt && <button type="button" className="link" onClick={() => markRead(n.id).then(load)}>Mark read</button>}
                </div>
              </li>
            ))}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)}>See all</Link>
        </div>
      )}
    </div>
  )
}
