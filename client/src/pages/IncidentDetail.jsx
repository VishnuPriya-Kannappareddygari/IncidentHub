import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchAssets } from '../api/assets.js'
import { acknowledgeIncident, addComment, escalateIncident, fetchIncident, fetchUsers, updateIncident } from '../api/incidents.js'
import { fetchTeams } from '../api/teams.js'
import AiAssistant from '../components/AiAssistant.jsx'
import { CategoryBadge, SeverityBadge, SlaBadge, StatusBadge } from '../components/Badges.jsx'
import { ProgressBar } from '../components/Charts.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { actorName, CATEGORIES, describeEvent, formatDate, formatMinutes, isStaff, label, SEVERITIES, STATUSES } from '../utils/format.js'

function SlaPanel({ incident }) {
  const sla = incident.sla
  if (!sla) return null
  const rows = [
    ['Response', sla.response, incident.responseDueAt, null],
    ['Resolution', sla.resolution, incident.resolveDueAt, sla.resolution?.percentElapsed],
  ]
  return (
    <section className="card" aria-label="SLA" data-testid="sla-panel">
      <div className="row between"><h2>SLA</h2><SlaBadge state={sla.overall} /></div>
      <div className="grid-2">
        {rows.map(([name, s, due, percent]) => s && (
          <div key={name}>
            <div className="row between"><strong>{name}</strong><SlaBadge state={s.state} /></div>
            <p className="muted">
              {due ? `Due ${formatDate(due)} · ` : ''}{s.state === 'MET' ? 'Target met' : formatMinutes(s.minutesRemaining)}
              {s.state !== 'MET' && s.minutesRemaining >= 0 ? ' left' : ''}
            </p>
            {percent != null && <ProgressBar percent={percent} state={s.state} />}
          </div>
        ))}
      </div>
      <p className="muted">
        {incident.respondedAt ? `Acknowledged ${formatDate(incident.respondedAt)}` : 'Not yet acknowledged'} · Escalation level {incident.escalationLevel ?? 0}/3
      </p>
    </section>
  )
}

function TextBlock({ title, value, field, canEdit, onSave, testId }) {
  const [text, setText] = useState(value || '')
  // Re-sync when the saved value changes (e.g. after "Use as ..." from the AI panel).
  useEffect(() => setText(value || ''), [value])
  return (
    <section className="card" aria-label={title}>
      <h2>{title}</h2>
      {canEdit ? (
        <form className="form" onSubmit={(e) => { e.preventDefault(); onSave({ [field]: text }) }}>
          <label>{title}<textarea data-testid={testId} value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={5000} /></label>
          <button type="submit" disabled={text === (value || '')}>Save {title.toLowerCase()}</button>
        </form>
      ) : (
        <p className="pre">{value || <span className="muted">Not recorded yet.</span>}</p>
      )}
    </section>
  )
}

export default function IncidentDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const staff = isStaff(user)
  const { data: incident, loading, error, reload } = useAsync(() => fetchIncident(id), [id])
  const { data: users } = useAsync(() => (staff ? fetchUsers() : Promise.resolve([])), [staff])
  const { data: assets } = useAsync(() => (staff ? fetchAssets().catch(() => ({ items: [] })) : Promise.resolve({ items: [] })), [staff])
  const { data: teams } = useAsync(() => (staff ? fetchTeams().catch(() => ({ items: [] })) : Promise.resolve({ items: [] })), [staff])
  const [comment, setComment] = useState('')
  const [escalating, setEscalating] = useState(false)
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState(null)

  async function run(action) {
    setActionError(null)
    try {
      await action()
      reload()
    } catch (err) {
      setActionError(err.message)
    }
  }

  if (loading && !incident) return <p role="status">Loading incident…</p>
  if (error) return <p role="alert" className="error">{error.message}</p>
  if (!incident) return null

  const patch = (changes) => run(() => updateIncident(id, changes))
  const closed = incident.status === 'RESOLVED' || incident.status === 'CLOSED'
  const canEditText = staff

  return (
    <div>
      <div className="row between wrap">
        <h1>#{incident.id} {incident.title}</h1>
        <div className="row">
          {incident.escalationLevel > 0 && <span className="badge sla-BREACHED">Escalated L{incident.escalationLevel}</span>}
          <CategoryBadge category={incident.category} />
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
        </div>
      </div>
      {actionError && <p role="alert" className="error">{actionError}</p>}

      <section className="card">
        <p className="pre">{incident.description}</p>
        <p className="muted">
          Reported by {incident.reporter.name} on {formatDate(incident.createdAt)} · Assignee: {incident.assignee?.name || 'Unassigned'}
          {incident.team && <> · Team: {incident.team.name}</>}
          {incident.asset && <> · Asset: {incident.asset.name} ({incident.asset.assetTag})</>}
          {incident.resolvedAt && <> · Resolved {formatDate(incident.resolvedAt)}</>}
        </p>
      </section>

      <SlaPanel incident={incident} />

      {staff && (
        <section className="card" aria-label="Lifecycle actions">
          <div className="row wrap">
            <button type="button" data-testid="acknowledge" disabled={Boolean(incident.respondedAt) || closed} onClick={() => run(() => acknowledgeIncident(id))}>
              {incident.respondedAt ? 'Acknowledged' : 'Acknowledge'}
            </button>
            <button type="button" data-testid="escalate" disabled={closed || incident.escalationLevel >= 3} onClick={() => setEscalating((v) => !v)}>
              Escalate
            </button>
          </div>
          {escalating && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  await escalateIncident(id, reason)
                  setReason('')
                  setEscalating(false)
                })
              }}
            >
              <label>Escalation reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required maxLength={500} /></label>
              <button type="submit" disabled={!reason.trim()}>Confirm escalation</button>
            </form>
          )}
        </section>
      )}

      {staff && (
        <section className="card filters" aria-label="Triage">
          <label>Status
            <select value={incident.status} onChange={(e) => patch({ status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </label>
          <label>Severity
            <select value={incident.severity} onChange={(e) => patch({ severity: e.target.value })}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>Category
            <select value={incident.category || ''} onChange={(e) => patch({ category: e.target.value || null })}>
              <option value="">Uncategorised</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
            </select>
          </label>
          <label>Assignee
            <select value={incident.assigneeId || ''} onChange={(e) => patch({ assigneeId: e.target.value || null })}>
              <option value="">Unassigned</option>
              {(users || []).filter((u) => u.role !== 'REPORTER').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label>Team
            <select value={incident.teamId || ''} onChange={(e) => patch({ teamId: e.target.value || null })}>
              <option value="">No team</option>
              {(teams?.items || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label>Asset
            <select value={incident.assetId || ''} onChange={(e) => patch({ assetId: e.target.value || null })}>
              <option value="">No asset</option>
              {(assets?.items || []).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.assetTag})</option>)}
            </select>
          </label>
        </section>
      )}

      <div className="grid-2">
        <TextBlock title="Root cause" field="rootCause" value={incident.rootCause} canEdit={canEditText} onSave={patch} testId="root-cause" />
        <TextBlock title="Resolution notes" field="resolutionNotes" value={incident.resolutionNotes} canEdit={canEditText} onSave={patch} testId="resolution-notes" />
      </div>

      {staff && <AiAssistant incident={incident} onApply={patch} />}

      <div className="grid-2">
        <section className="card" aria-label="Comments">
          <h2>Comments ({incident.comments.length})</h2>
          {incident.comments.length === 0 && <p className="muted">No comments yet.</p>}
          {incident.comments.map((c) => (
            <article key={c.id} className="comment">
              <strong>{c.author.name}</strong> <span className="muted">{formatDate(c.createdAt)}</span>
              <p className="pre">{c.body}</p>
            </article>
          ))}
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                await addComment(id, comment)
                setComment('')
              })
            }}
          >
            <label>Add a comment<textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} required maxLength={2000} /></label>
            <button type="submit" disabled={!comment.trim()}>Post comment</button>
          </form>
        </section>

        <section className="card" aria-label="Activity timeline">
          <h2>Activity</h2>
          <ul className="timeline">
            {incident.events.map((e) => (
              <li key={e.id}>
                <strong>{actorName(e.actor)}</strong> {describeEvent(e)}
                <span className="muted"> · {formatDate(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
