import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchActivity } from '../api/activity.js'
import { useAsync } from '../hooks/useAsync.js'
import { actorName, describeEvent, formatDate, label } from '../utils/format.js'

export default function ActivityLog() {
  const [source, setSource] = useState('')
  const [limit, setLimit] = useState('50')
  const { data, loading, error, reload } = useAsync(() => fetchActivity({ source, limit }), [source, limit])

  return (
    <div>
      <h1>Activity log</h1>
      <div className="card filters">
        <label>Source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            <option value="incident">Incident events</option>
            <option value="audit">Audit</option>
            <option value="agent">AI agents</option>
          </select>
        </label>
        <label>Show
          <select value={limit} onChange={(e) => setLimit(e.target.value)}>
            {['25', '50', '100', '200'].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" onClick={reload}>Refresh</button>
      </div>
      {loading && <p role="status">Loading activity…</p>}
      {error && <p role="alert" className="error">{error.message} <button onClick={reload}>Retry</button></p>}
      {data && data.items.length === 0 && <p className="card muted">No activity recorded.</p>}
      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table className="card table" data-testid="activity-table">
            <thead><tr><th>When</th><th>Source</th><th>Actor</th><th>Event</th><th>Incident</th></tr></thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={`${e.source}-${e.id}`}>
                  <td>{formatDate(e.createdAt)}</td>
                  <td><span className="badge">{label(e.source)}</span></td>
                  <td>{actorName(e.actor)}</td>
                  <td>{e.source === 'incident' ? describeEvent(e) : label(e.type)}</td>
                  <td>{e.incidentId ? <Link to={`/incidents/${e.incidentId}`}>#{e.incidentId} {e.incidentTitle}</Link> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
