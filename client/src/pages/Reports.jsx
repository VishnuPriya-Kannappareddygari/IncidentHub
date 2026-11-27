import { useState } from 'react'
import { Link } from 'react-router-dom'
import { executiveReport } from '../api/ai.js'
import { downloadIncidentsCsv, downloadIncidentsJson, downloadSlaCsv, fetchSummary } from '../api/reports.js'
import { SourceBadge } from '../components/Badges.jsx'
import { BarChart } from '../components/Charts.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { errorText, formatMinutes, label, SEVERITIES } from '../utils/format.js'

export default function Reports() {
  const [days, setDays] = useState('30')
  const { data, loading, error, reload } = useAsync(() => fetchSummary(days), [days])
  const [exportError, setExportError] = useState(null)
  const [ai, setAi] = useState({ loading: false, result: null, error: null })

  async function exportFile(fn) {
    setExportError(null)
    try {
      await fn()
    } catch (err) {
      setExportError(err.message)
    }
  }

  async function runAi() {
    setAi({ loading: true, result: null, error: null })
    try {
      setAi({ loading: false, result: await executiveReport(Number(days)), error: null })
    } catch (err) {
      setAi({ loading: false, result: null, error: errorText(err) })
    }
  }

  const out = ai.result?.output
  const k = data?.kpis || {}

  return (
    <div>
      <div className="row between wrap">
        <h1>Reports</h1>
        <div className="row wrap">
          <label>Period
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              {['7', '14', '30', '90'].map((d) => <option key={d} value={d}>Last {d} days</option>)}
            </select>
          </label>
          <button type="button" onClick={() => exportFile(() => downloadIncidentsCsv({ from: data?.period?.from, to: data?.period?.to }))} data-testid="export-incidents-csv">Incidents CSV</button>
          <button type="button" onClick={() => exportFile(() => downloadIncidentsJson({ from: data?.period?.from, to: data?.period?.to }))}>Incidents JSON</button>
          <button type="button" onClick={() => exportFile(downloadSlaCsv)}>SLA CSV</button>
        </div>
      </div>
      {exportError && <p role="alert" className="error">{exportError}</p>}
      {loading && !data && <p role="status">Loading report…</p>}
      {error && <p role="alert" className="error">{error.message} <button onClick={reload}>Retry</button></p>}

      {data && (
        <>
          <div className="stat-grid">
            <div className="card stat"><strong>{data.totals.created}</strong><span>Created</span></div>
            <div className="card stat"><strong>{data.totals.resolved}</strong><span>Resolved</span></div>
            <div className="card stat"><strong>{data.totals.active}</strong><span>Active</span></div>
            <div className="card stat"><strong>{data.sla.compliancePct != null ? `${Math.round(data.sla.compliancePct)}%` : '—'}</strong><span>SLA compliance ({data.sla.met} met / {data.sla.breached} breached)</span></div>
            <div className="card stat"><strong>{formatMinutes(k.mttaMinutes)}</strong><span>MTTA</span></div>
            <div className="card stat"><strong>{formatMinutes(k.mttrMinutes)}</strong><span>MTTR</span></div>
          </div>
          <div className="grid-2">
            <BarChart title="By severity" rows={SEVERITIES.map((s) => ({ key: s, label: s, value: data.bySeverity?.[s] || 0 }))} className={(key) => `sev-${key}`} />
            <BarChart title="By category" rows={Object.entries(data.byCategory || {}).map(([c, v]) => ({ key: c, label: label(c), value: v }))} />
          </div>
          <section className="card" aria-label="Top assets">
            <h2>Most affected assets</h2>
            {(data.topAssets || []).length === 0 ? <p className="muted">No asset-linked incidents in this period.</p> : (
              <ol>{data.topAssets.map((a) => <li key={a.assetId}>{a.name} <span className="muted">· {a.count} incidents</span></li>)}</ol>
            )}
          </section>
        </>
      )}

      <section className="card" aria-label="AI executive summary">
        <div className="row between">
          <h2>AI executive summary</h2>
          <button type="button" onClick={runAi} disabled={ai.loading} data-testid="ai-exec-summary">{ai.loading ? 'Generating…' : 'Generate with AI'}</button>
        </div>
        {ai.error && <p role="alert" className="error">{ai.error}</p>}
        {out && (
          <div data-testid="ai-exec-result">
            <p><SourceBadge source={ai.result.source} /> <strong>{out.headline}</strong></p>
            <p>{out.narrative}</p>
            {out.highlights?.length > 0 && <><h3>Highlights</h3><ul>{out.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul></>}
            {out.risks?.length > 0 && <><h3>Risks</h3><ul>{out.risks.map((h, i) => <li key={i}>{h}</li>)}</ul></>}
            {out.recommendations?.length > 0 && <><h3>Recommendations</h3><ul>{out.recommendations.map((h, i) => <li key={i}>{h}</li>)}</ul></>}
          </div>
        )}
        {!out && !ai.loading && !ai.error && <p className="muted">Generate a narrative summary of the selected period. Review before sharing. <Link to="/ai-ops">AI governance</Link></p>}
      </section>
    </div>
  )
}
