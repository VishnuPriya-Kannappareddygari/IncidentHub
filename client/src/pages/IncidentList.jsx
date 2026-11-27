import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchIncidents, fetchUsers } from '../api/incidents.js'
import { downloadIncidentsCsv } from '../api/reports.js'
import { CategoryBadge, SeverityBadge, SlaBadge, StatusBadge } from '../components/Badges.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { CATEGORIES, formatDate, isStaff, label, SEVERITIES, STATUSES } from '../utils/format.js'

export default function IncidentList() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const filters = {
    page: params.get('page') || '1',
    q: params.get('q') || '',
    status: params.get('status') || '',
    severity: params.get('severity') || '',
    assigneeId: params.get('assigneeId') || '',
    category: params.get('category') || '',
    sla: params.get('sla') || '',
    escalated: params.get('escalated') || '',
    sortBy: params.get('sortBy') || 'createdAt',
    order: params.get('order') || 'desc',
  }
  const [search, setSearch] = useState(filters.q)
  const staff = isStaff(user)
  const [exportError, setExportError] = useState(null)

  const { data, loading, error, reload } = useAsync(() => fetchIncidents({ ...filters, pageSize: 10 }), [params.toString()])
  const { data: users } = useAsync(() => (staff ? fetchUsers() : Promise.resolve([])), [staff])

  // Debounce text search into the URL so filters are shareable and back-button friendly.
  useEffect(() => {
    if (search === filters.q) return
    const t = setTimeout(() => update({ q: search }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function update(changes) {
    const next = new URLSearchParams(params)
    Object.entries({ page: '1', ...changes }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next)
  }

  async function exportCsv() {
    setExportError(null)
    try {
      await downloadIncidentsCsv({ status: filters.status, severity: filters.severity })
    } catch (err) {
      setExportError(err.message)
    }
  }

  return (
    <div>
      <div className="row between">
        <h1>Incidents</h1>
        <div className="row">
          {staff && <button type="button" onClick={exportCsv} data-testid="export-csv">Export CSV</button>}
          <Link className="button" to="/incidents/new">Report incident</Link>
        </div>
      </div>
      {exportError && <p role="alert" className="error">{exportError}</p>}

      <div className="card filters">
        <label>Search<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title or description" /></label>
        <label>Status
          <select value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </label>
        <label>Severity
          <select value={filters.severity} onChange={(e) => update({ severity: e.target.value })}>
            <option value="">All</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Category
          <select value={filters.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
        </label>
        <label>SLA
          <select value={filters.sla} onChange={(e) => update({ sla: e.target.value })}>
            <option value="">Any</option>
            <option value="breached">Breached</option>
            <option value="at_risk">At risk</option>
          </select>
        </label>
        <label>Escalated
          <select value={filters.escalated} onChange={(e) => update({ escalated: e.target.value })}>
            <option value="">Any</option>
            <option value="true">Escalated only</option>
          </select>
        </label>
        {staff && (
          <label>Assignee
            <select value={filters.assigneeId} onChange={(e) => update({ assigneeId: e.target.value })}>
              <option value="">Anyone</option>
              <option value="unassigned">Unassigned</option>
              {(users || []).filter((u) => u.role !== 'REPORTER').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
        )}
        <label>Sort
          <select value={`${filters.sortBy}:${filters.order}`} onChange={(e) => { const [sortBy, order] = e.target.value.split(':'); update({ sortBy, order }) }}>
            <option value="createdAt:desc">Newest</option>
            <option value="createdAt:asc">Oldest</option>
            <option value="updatedAt:desc">Recently updated</option>
            <option value="severity:asc">Severity (high first)</option>
          </select>
        </label>
      </div>

      {loading && <p role="status">Loading incidents…</p>}
      {error && <p role="alert" className="error">{error.message} <button onClick={reload}>Retry</button></p>}
      {data && data.items.length === 0 && <p className="card muted">No incidents match these filters.</p>}
      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap"><table className="card table" data-testid="incident-table">
            <thead>
              <tr><th>#</th><th>Title</th><th>Severity</th><th>Status</th><th>Category</th><th>SLA</th><th>Assignee</th><th>Created</th></tr>
            </thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.id}</td>
                  <td><Link to={`/incidents/${i.id}`}>{i.title}</Link> {i._count.comments > 0 && <span className="muted">({i._count.comments})</span>}</td>
                  <td><SeverityBadge severity={i.severity} /></td>
                  <td><StatusBadge status={i.status} /></td>
                  <td><CategoryBadge category={i.category} /></td>
                  <td><SlaBadge state={i.sla?.overall} />{i.escalationLevel > 0 && <span className="badge sla-BREACHED">L{i.escalationLevel}</span>}</td>
                  <td>{i.assignee?.name || <span className="muted">Unassigned</span>}</td>
                  <td>{formatDate(i.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="row between">
            <span className="muted">{data.total} incidents</span>
            <div className="row">
              <button disabled={data.page <= 1} onClick={() => update({ page: String(data.page - 1) })}>Previous</button>
              <span>Page {data.page} of {data.totalPages}</span>
              <button disabled={data.page >= data.totalPages} onClick={() => update({ page: String(data.page + 1) })}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
