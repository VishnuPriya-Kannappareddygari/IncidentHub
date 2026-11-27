import { Link } from 'react-router-dom'
import { fetchNotifications, markAllRead, markRead } from '../api/notifications.js'
import { useAsync } from '../hooks/useAsync.js'
import { formatDate, label } from '../utils/format.js'

export default function Notifications() {
  const { data, loading, error, reload } = useAsync(fetchNotifications, [])

  return (
    <div>
      <div className="row between">
        <h1>Notifications</h1>
        <button type="button" disabled={!data || data.unread === 0} onClick={() => markAllRead().then(reload)}>Mark all read</button>
      </div>
      {loading && !data && <p role="status">Loading notifications…</p>}
      {error && <p role="alert" className="error">{error.message} <button onClick={reload}>Retry</button></p>}
      {data && data.items.length === 0 && <p className="card muted">No notifications.</p>}
      {data && data.items.map((n) => (
        <article key={n.id} className={`card notification ${n.readAt ? '' : 'unread'}`}>
          <div className="row between">
            <strong>{n.title}</strong>
            <span className="badge">{label(n.type)}</span>
          </div>
          <p>{n.body}</p>
          <div className="row">
            <span className="muted">{formatDate(n.createdAt)}</span>
            {n.incidentId && <Link to={`/incidents/${n.incidentId}`}>Open incident #{n.incidentId}</Link>}
            {!n.readAt && <button type="button" className="ghost" onClick={() => markRead(n.id).then(reload)}>Mark read</button>}
          </div>
        </article>
      ))}
    </div>
  )
}
