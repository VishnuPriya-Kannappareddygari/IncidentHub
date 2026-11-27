import { useState } from 'react'
import { Link } from 'react-router-dom'
import { analyzeIncident, fetchRuns, sendFeedback } from '../api/ai.js'
import { fetchSimilar } from '../api/incidents.js'
import { useAsync } from '../hooks/useAsync.js'
import { errorText, formatDate, label } from '../utils/format.js'
import { SeverityBadge, SourceBadge, StatusBadge } from './Badges.jsx'

const pct = (n) => (n == null ? '—' : `${Math.round(n * 100)}%`)

function Feedback({ run }) {
  const [sent, setSent] = useState(null)
  const [err, setErr] = useState(null)
  async function send(accepted) {
    setErr(null)
    try {
      await sendFeedback(run.runId, { accepted })
      setSent(accepted)
    } catch (e) {
      setErr(e.message)
    }
  }
  return (
    <span className="feedback">
      <button type="button" className="ghost" aria-label="Helpful" aria-pressed={sent === true} disabled={sent !== null} onClick={() => send(true)}>👍</button>
      <button type="button" className="ghost" aria-label="Not helpful" aria-pressed={sent === false} disabled={sent !== null} onClick={() => send(false)}>👎</button>
      {err && <span className="error">{err}</span>}
    </span>
  )
}

function AgentHeader({ title, run }) {
  return (
    <div className="row between">
      <h3>{title}</h3>
      <span className="row">
        <SourceBadge source={run.source} />
        <span className="muted">{run.latencyMs}ms</span>
        <Feedback run={run} />
      </span>
    </div>
  )
}

// Human-in-the-loop: every "Apply"/"Use" button calls onApply; nothing is written automatically.
export default function AiAssistant({ incident, onApply, disabled }) {
  const [state, setState] = useState({ loading: false, results: null, error: null })
  const { data: runs, reload: reloadRuns } = useAsync(() => fetchRuns(incident.id), [incident.id])
  const { data: similar, loading: simLoading, error: simError } = useAsync(() => fetchSimilar(incident.id), [incident.id])

  async function analyze() {
    setState({ loading: true, results: null, error: null })
    try {
      const res = await analyzeIncident(incident.id)
      setState({ loading: false, results: res.results, error: null })
      reloadRuns()
    } catch (err) {
      setState({ loading: false, results: null, error: errorText(err) })
    }
  }

  const r = state.results
  const analysis = r?.analysis
  const priority = r?.priority
  const rca = r?.rootCause
  const resolution = r?.resolution

  return (
    <section className="card ai-panel" aria-label="AI assistant" data-testid="ai-panel">
      <div className="row between">
        <h2>AI assistant</h2>
        <button type="button" onClick={analyze} disabled={state.loading} data-testid="ai-analyze">{state.loading ? 'Analyzing…' : 'Analyze with AI'}</button>
      </div>
      <p className="muted">Suggestions only. Nothing changes until you click an apply button.</p>
      {state.error && <p role="alert" className="error">{state.error}</p>}
      {incident.aiSummary && !analysis && <p><strong>Last summary:</strong> {incident.aiSummary}</p>}

      {analysis && (
        <div className="ai-block" data-testid="ai-analysis">
          <AgentHeader title="Summary" run={analysis} />
          <p>{analysis.output.summary}</p>
          <ul>{(analysis.output.keyPoints || []).map((p, i) => <li key={i}>{p}</li>)}</ul>
          <p className="muted">Category: {label(analysis.output.category)} · Impact: {analysis.output.impact} · Confidence {pct(analysis.output.confidence)}</p>
          {analysis.flags?.length > 0 && <p className="warn">Flags: {analysis.flags.join(', ')}</p>}
          {analysis.output.category && analysis.output.category !== incident.category && (
            <button type="button" disabled={disabled} onClick={() => onApply({ category: analysis.output.category })}>Apply category {label(analysis.output.category)}</button>
          )}
        </div>
      )}

      {priority && (
        <div className="ai-block" data-testid="ai-priority">
          <AgentHeader title="Priority suggestion" run={priority} />
          <p><SeverityBadge severity={priority.output.severity} /> urgency {priority.output.urgency} · confidence {pct(priority.output.confidence)}</p>
          <p>{priority.output.rationale}</p>
          <ul>{(priority.output.factors || []).map((f, i) => <li key={i}>{f}</li>)}</ul>
          {priority.output.severity !== incident.severity && (
            <button type="button" disabled={disabled} onClick={() => onApply({ severity: priority.output.severity })} data-testid="apply-severity">Apply severity {priority.output.severity}</button>
          )}
        </div>
      )}

      {rca && (
        <div className="ai-block" data-testid="ai-rca">
          <AgentHeader title="Root cause hypotheses" run={rca} />
          {(rca.output.hypotheses || []).map((h, i) => (
            <article key={i} className="hypothesis">
              <strong>{h.cause}</strong> <span className="muted">likelihood {pct(h.likelihood)}</span>
              <p>{h.evidence}</p>
              <ul>{(h.verificationSteps || []).map((s, j) => <li key={j}>{s}</li>)}</ul>
              <button type="button" disabled={disabled} onClick={() => onApply({ rootCause: h.cause })}>Use as root cause</button>
            </article>
          ))}
        </div>
      )}

      {resolution && (
        <div className="ai-block" data-testid="ai-resolution">
          <AgentHeader title="Resolution steps" run={resolution} />
          <ol>
            {(resolution.output.steps || []).map((s) => (
              <li key={s.order}>{s.action} <span className={`badge risk-${s.risk}`}>{s.risk}</span>{s.rollback && <div className="muted">Rollback: {s.rollback}</div>}</li>
            ))}
          </ol>
          {resolution.output.preventiveActions?.length > 0 && (
            <><strong>Preventive actions</strong><ul>{resolution.output.preventiveActions.map((a, i) => <li key={i}>{a}</li>)}</ul></>
          )}
          <p className="muted">Estimated {resolution.output.estimatedMinutes} min · confidence {pct(resolution.output.confidence)}</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApply({ resolutionNotes: (resolution.output.steps || []).map((s) => `${s.order}. ${s.action}`).join('\n') })}
          >
            Use as resolution notes
          </button>
        </div>
      )}

      <h3>Similar incidents</h3>
      {simLoading && <p role="status">Searching…</p>}
      {simError && <p role="alert" className="error">{simError.message}</p>}
      {similar && similar.items.length === 0 && <p className="muted">No similar incidents found.</p>}
      <ul className="timeline" data-testid="similar-list">
        {(similar?.items || []).map((s) => (
          <li key={s.id}>
            <Link to={`/incidents/${s.id}`}>#{s.id} {s.title}</Link> <SeverityBadge severity={s.severity} /> <StatusBadge status={s.status} />
            <span className="muted"> · match {pct(s.score)}</span>
            {s.resolutionNotes && <div className="muted">Fix: {s.resolutionNotes.slice(0, 160)}</div>}
          </li>
        ))}
      </ul>

      <h3>AI run history</h3>
      {runs && runs.items.length === 0 && <p className="muted">No AI runs yet.</p>}
      {runs && runs.items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Agent</th><th>Source</th><th>Status</th><th>Latency</th><th>Accepted</th><th>When</th></tr></thead>
            <tbody>
              {runs.items.map((x) => (
                <tr key={x.id}>
                  <td>{x.agent}</td><td>{x.source}</td><td>{x.status}</td><td>{x.latencyMs}ms</td>
                  <td>{x.accepted == null ? '—' : x.accepted ? 'Yes' : 'No'}</td><td>{formatDate(x.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
