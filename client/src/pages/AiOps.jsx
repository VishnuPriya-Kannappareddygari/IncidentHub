import { useState } from 'react'
import { fetchAgents, fetchEvals, fetchGovernance, fetchObservability, runEvals } from '../api/ai.js'
import { SourceBadge } from '../components/Badges.jsx'
import { BarChart } from '../components/Charts.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { errorText, formatDate } from '../utils/format.js'

const pct = (n) => (n == null ? '—' : `${Math.round(n * 100)}%`)

function Section({ title, state, children }) {
  return (
    <section className="card" aria-label={title}>
      <h2>{title}</h2>
      {state.loading && !state.data && <p role="status">Loading…</p>}
      {state.error && <p role="alert" className="error">{state.error.message} <button onClick={state.reload}>Retry</button></p>}
      {state.data && children}
    </section>
  )
}

export default function AiOps() {
  const { user } = useAuth()
  const [days, setDays] = useState('7')
  const agents = useAsync(fetchAgents, [])
  const obs = useAsync(() => fetchObservability(days), [days])
  const gov = useAsync(fetchGovernance, [])
  const evals = useAsync(fetchEvals, [])
  const [evalState, setEvalState] = useState({ running: false, error: null })

  async function runEval(mode) {
    setEvalState({ running: true, error: null })
    try {
      await runEvals(mode)
      setEvalState({ running: false, error: null })
      evals.reload()
    } catch (err) {
      setEvalState({ running: false, error: errorText(err) })
    }
  }

  const t = obs.data?.totals

  return (
    <div>
      <h1>AI operations</h1>

      <Section title="Agent registry" state={agents}>
        <p className="muted">
          Mode: {agents.data.llmEnabled ? `Claude (${agents.data.model})` : 'Heuristic only (no API key configured)'} · agents are read-only and never change incidents.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Agent</th><th>Purpose</th><th>Writes data</th></tr></thead>
            <tbody>
              {agents.data.items.map((a) => <tr key={a.name}><td><strong>{a.title}</strong><div className="muted">{a.name}</div></td><td>{a.description}</td><td>{a.mutates ? 'Yes' : 'No'}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="row between">
        <h2>Observability</h2>
        <label>Window
          <select value={days} onChange={(e) => setDays(e.target.value)}>{['1', '7', '14', '30'].map((d) => <option key={d} value={d}>{d} day{d === '1' ? '' : 's'}</option>)}</select>
        </label>
      </div>
      <Section title="Agent metrics" state={obs}>
        <div className="stat-grid">
          <div className="card stat"><strong>{t.runs}</strong><span>Runs</span></div>
          <div className="card stat"><strong>{pct(t.successRate)}</strong><span>Success rate</span></div>
          <div className="card stat"><strong>{pct(t.fallbackRate)}</strong><span>Fallback rate</span></div>
          <div className="card stat"><strong>{Math.round(t.avgLatencyMs)}ms</strong><span>Avg latency</span></div>
          <div className="card stat"><strong>{pct(t.acceptanceRate)}</strong><span>Human acceptance</span></div>
          <div className="card stat"><strong>{t.tokensIn + t.tokensOut}</strong><span>Tokens ({t.tokensIn} in / {t.tokensOut} out)</span></div>
        </div>
        {obs.data.budget && <BarChart title={`Daily budget (${obs.data.budget.used}/${obs.data.budget.limit} calls)`} rows={[{ key: 'used', label: 'Used', value: obs.data.budget.used }, { key: 'limit', label: 'Limit', value: obs.data.budget.limit }]} />}
        <div className="table-wrap">
          <table className="table" data-testid="agent-metrics">
            <thead><tr><th>Agent</th><th>Runs</th><th>Success</th><th>Avg latency</th><th>Fallback</th><th>Accepted</th></tr></thead>
            <tbody>
              {obs.data.byAgent.map((a) => (
                <tr key={a.agent}><td>{a.agent}</td><td>{a.runs}</td><td>{pct(a.successRate)}</td><td>{Math.round(a.avgLatencyMs)}ms</td><td>{pct(a.fallbackRate)}</td><td>{pct(a.acceptanceRate)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Recent runs</h3>
        {obs.data.recent.length === 0 ? <p className="muted">No runs in this window.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Agent</th><th>Source</th><th>Status</th><th>Latency</th><th>Error</th></tr></thead>
              <tbody>
                {obs.data.recent.map((r) => (
                  <tr key={r.id}><td>{formatDate(r.createdAt)}</td><td>{r.agent}</td><td><SourceBadge source={r.source} /></td><td>{r.status}</td><td>{r.latencyMs}ms</td><td className="error">{r.error || ''}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Governance" state={gov}>
        <div className="stat-grid">
          <div className="card stat"><strong>{gov.data.usedToday}/{gov.data.dailyLimit}</strong><span>LLM calls today</span></div>
          <div className="card stat"><strong>{gov.data.injectionFlags7d}</strong><span>Prompt-injection flags (7d)</span></div>
          <div className="card stat"><strong>{gov.data.llmEnabled ? 'On' : 'Off'}</strong><span>LLM {gov.data.model ? `(${gov.data.model})` : ''}</span></div>
        </div>
        <ul>{gov.data.policies.map((p) => <li key={p.id}><strong>{p.title}</strong>: {p.description}</li>)}</ul>
      </Section>

      <Section title="Agent evaluations" state={evals}>
        {user.role === 'ADMIN' && (
          <div className="row">
            <button type="button" disabled={evalState.running} onClick={() => runEval('heuristic')} data-testid="run-evals">{evalState.running ? 'Running…' : 'Run evals (heuristic)'}</button>
            <button type="button" className="ghost" disabled={evalState.running || !gov.data?.llmEnabled} onClick={() => runEval('live')}>Run evals (live Claude)</button>
          </div>
        )}
        {evalState.error && <p role="alert" className="error">{evalState.error}</p>}
        {evals.data.items.length === 0 && <p className="muted">No evaluation runs yet.</p>}
        {evals.data.items.map((e) => (
          <div key={e.id} className="eval-run">
            <p><strong>{formatDate(e.createdAt)}</strong> · mode {e.mode} · overall <strong>{pct(e.overall)}</strong></p>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Agent</th><th>Passed</th><th>Score</th></tr></thead>
                <tbody>{e.results.map((r) => <tr key={r.agent}><td>{r.agent}</td><td>{r.passed}/{r.total}</td><td>{pct(r.score)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        ))}
      </Section>
    </div>
  )
}
