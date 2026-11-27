import { useState } from 'react'
import { Link } from 'react-router-dom'
import { monitorSla } from '../api/ai.js'
import { fetchStats } from '../api/incidents.js'
import { SeverityBadge, SlaBadge, SourceBadge } from '../components/Badges.jsx'
import { BarChart, LineChart } from '../components/Charts.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { actorName, CATEGORIES, describeEvent, errorText, formatDate, formatMinutes, isStaff, label, SEVERITIES, STATUSES } from '../utils/format.js'

const Tile = ({ id, value, text, tone }) => (
  <div className={`card stat ${tone || ''}`} data-testid={id}><strong>{value}</strong><span>{text}</span></div>
)

export default function Dashboard() {
  const { user } = useAuth()
  const staff = isStaff(user)
  const { data, loading, error, reload } = useAsync(fetchStats, [])
  const [monitor, setMonitor] = useState({ loading: false, result: null, error: null })

  async function runMonitor() {
    setMonitor({ loading: true, result: null, error: null })
    try {
      setMonitor({ loading: false, result: await monitorSla(), error: null })
    } catch (err) {
      setMonitor({ loading: false, result: null, error: errorText(err) })
    }
  }

  if (loading) return <p role="status">Loading dashboard…</p>
  if (error) return <p role="alert" className="error">{error.message} <button onClick={reload}>Retry</button></p>

  const k = data.kpis || {}
  const byCategory = data.byCategory || {}
  const catRows = CATEGORIES.filter((c) => byCategory[c]).map((c) => ({ key: c, label: label(c), value: byCategory[c] }))
  const watchlist = data.slaWatchlist || []
  const workload = data.workload || []
  const sla = monitor.result?.output

  return (
    <div>
      <div className="row between">
        <h1>Dashboard</h1>
        {staff && <button type="button" onClick={runMonitor} disabled={monitor.loading} data-testid="run-sla-monitor">{monitor.loading ? 'Running…' : 'Run SLA monitor agent'}</button>}
      </div>

      <div className="stat-grid">
        <Tile id="stat-total" value={data.totals.total} text="Total incidents" />
        <Tile id="stat-active" value={data.totals.active} text="Active incidents" />
        <Tile id="stat-sla" value={k.slaCompliancePct != null ? `${Math.round(k.slaCompliancePct)}%` : '—'} text="SLA compliance" />
        <Tile id="stat-mtta" value={formatMinutes(k.mttaMinutes)} text="MTTA" />
        <Tile id="stat-mttr" value={formatMinutes(k.mttrMinutes)} text="MTTR" />
        <Tile id="stat-breached" value={k.breached ?? 0} text="SLA breached" tone={k.breached > 0 ? 'tone-bad' : ''} />
        <Tile id="stat-atrisk" value={k.atRisk ?? 0} text="At risk" tone={k.atRisk > 0 ? 'tone-warn' : ''} />
        <Tile id="stat-escalated" value={k.escalated ?? 0} text="Escalated" />
        <Tile id="stat-unassigned" value={data.totals.unassignedOpen} text="Unassigned & active" />
      </div>

      {monitor.error && <p role="alert" className="error">{monitor.error}</p>}
      {sla && (
        <section className="card" aria-label="SLA monitor result" data-testid="sla-monitor-result">
          <div className="row between"><h2>SLA monitor agent</h2><SourceBadge source={monitor.result.source} /></div>
          <p>{sla.narrative}</p>
          {sla.overall && <p className="muted">Breached {sla.overall.breached} · At risk {sla.overall.atRisk} · Healthy {sla.overall.healthy}</p>}
          {sla.escalationRecommendations?.length > 0 && (
            <ul>{sla.escalationRecommendations.map((r, i) => <li key={i}>{typeof r === 'string' ? r : JSON.stringify(r)}</li>)}</ul>
          )}
        </section>
      )}

      <LineChart
        title="Created vs resolved (14 days)"
        series={[
          { name: 'Created', color: '#2b5cd9', points: data.trend },
          ...(data.trendResolved ? [{ name: 'Resolved', color: '#27ae60', points: data.trendResolved }] : []),
        ]}
      />

      <div className="grid-2">
        <BarChart title="By status" rows={STATUSES.map((s) => ({ key: s, label: label(s), value: data.byStatus[s] }))} className={(key) => `status-${key}`} />
        <BarChart title="By severity" rows={SEVERITIES.map((s) => ({ key: s, label: s, value: data.bySeverity[s] }))} className={(key) => `sev-${key}`} />
        <BarChart title="By category" rows={catRows} />
        <BarChart title="Workload (active per assignee)" rows={workload.map((w) => ({ key: w.user?.id || 'none', label: w.user?.name || 'Unassigned', value: w.active }))} />
      </div>

      <section className="card" aria-label="SLA watchlist">
        <h2>SLA watchlist</h2>
        {watchlist.length === 0 ? <p className="muted">No incidents are breached or at risk.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Title</th><th>Severity</th><th>SLA</th><th>Time left</th></tr></thead>
              <tbody>
                {watchlist.map((i) => (
                  <tr key={i.id}>
                    <td>{i.id}</td>
                    <td><Link to={`/incidents/${i.id}`}>{i.title}</Link></td>
                    <td><SeverityBadge severity={i.severity} /></td>
                    <td><SlaBadge state={i.sla?.overall} /></td>
                    <td>{formatMinutes(i.sla?.resolution?.minutesRemaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" aria-label="Recent activity">
        <h2>Recent activity</h2>
        {data.recentActivity.length === 0 ? (
          <p className="muted">No activity yet.</p>
        ) : (
          <ul className="timeline">
            {data.recentActivity.map((e) => (
              <li key={e.id}>
                <strong>{actorName(e.actor)}</strong> {describeEvent(e)} on <Link to={`/incidents/${e.incident.id}`}>#{e.incident.id} {e.incident.title}</Link>
                <span className="muted"> · {formatDate(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
