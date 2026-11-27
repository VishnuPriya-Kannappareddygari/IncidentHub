import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchAssets } from '../api/assets.js'
import { triage } from '../api/ai.js'
import { createIncident } from '../api/incidents.js'
import { SourceBadge } from '../components/Badges.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { CATEGORIES, errorText, label, SEVERITIES } from '../utils/format.js'

export default function NewIncident() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', description: '', severity: 'SEV3', category: '', assetId: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [ai, setAi] = useState({ loading: false, data: null, error: null })
  const { data: assets } = useAsync(() => fetchAssets().catch(() => ({ items: [] })), [])
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  async function runTriage() {
    setAi({ loading: true, data: null, error: null })
    try {
      setAi({ loading: false, data: await triage({ title: form.title, description: form.description, ...(form.assetId && { assetId: form.assetId }) }), error: null })
    } catch (err) {
      setAi({ loading: false, data: null, error: errorText(err) })
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = { title: form.title, description: form.description, severity: form.severity }
      if (form.category) payload.category = form.category
      if (form.assetId) payload.assetId = form.assetId
      const created = await createIncident(payload)
      navigate(`/incidents/${created.id}`)
    } catch (err) {
      setError(errorText(err))
      setSubmitting(false)
    }
  }

  const suggestion = ai.data?.results
  const sevSuggestion = suggestion?.priority?.output?.severity
  const catSuggestion = suggestion?.analysis?.output?.category
  const duplicates = (ai.data?.similar || []).filter((s) => s.score >= 0.5)
  const canTriage = form.title.trim().length >= 3 && form.description.trim().length > 0

  return (
    <form className="card form narrow wide" onSubmit={onSubmit}>
      <h1>Report an incident</h1>
      {error && <p role="alert" className="error">{error}</p>}
      <label>Title<input value={form.title} onChange={set('title')} required minLength={3} maxLength={150} /></label>
      <label>Description<textarea value={form.description} onChange={set('description')} required rows={5} maxLength={5000} /></label>
      <div className="filters">
        <label>Severity
          <select value={form.severity} onChange={set('severity')}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Category
          <select value={form.category} onChange={set('category')}>
            <option value="">Not sure</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
        </label>
        <label>Affected asset
          <select value={form.assetId} onChange={set('assetId')}>
            <option value="">None / unknown</option>
            {(assets?.items || []).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.assetTag})</option>)}
          </select>
        </label>
      </div>

      <div className="ai-block">
        <div className="row between">
          <strong>AI triage</strong>
          <button type="button" onClick={runTriage} disabled={!canTriage || ai.loading} data-testid="ai-triage">{ai.loading ? 'Analyzing…' : 'Suggest with AI'}</button>
        </div>
        {ai.error && <p role="alert" className="error">{ai.error}</p>}
        {suggestion && (
          <div data-testid="ai-triage-result">
            <p className="muted">Suggestions only <SourceBadge source={suggestion.analysis?.source || 'heuristic'} /></p>
            {suggestion.analysis?.output?.summary && <p>{suggestion.analysis.output.summary}</p>}
            {sevSuggestion && (
              <p>Suggested severity <strong>{sevSuggestion}</strong>
                {sevSuggestion !== form.severity && <> <button type="button" onClick={() => setForm((f) => ({ ...f, severity: sevSuggestion }))}>Apply severity</button></>}
              </p>
            )}
            {catSuggestion && (
              <p>Suggested category <strong>{label(catSuggestion)}</strong>
                {catSuggestion !== form.category && <> <button type="button" onClick={() => setForm((f) => ({ ...f, category: catSuggestion }))}>Apply category</button></>}
              </p>
            )}
          </div>
        )}
        {duplicates.length > 0 && (
          <div role="alert" className="warn" data-testid="duplicate-warning">
            Possible duplicates — check before submitting:
            <ul>{duplicates.map((d) => <li key={d.id}><Link to={`/incidents/${d.id}`} target="_blank">#{d.id} {d.title}</Link> ({Math.round(d.score * 100)}% match)</li>)}</ul>
          </div>
        )}
      </div>

      <button type="submit" disabled={submitting}>Submit incident</button>
    </form>
  )
}
