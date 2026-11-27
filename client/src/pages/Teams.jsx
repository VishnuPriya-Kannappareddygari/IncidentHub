import { useState } from 'react'
import { createTeam, deleteTeam, fetchTeams, updateTeam } from '../api/teams.js'
import { useAsync } from '../hooks/useAsync.js'
import { errorText } from '../utils/format.js'

export default function Teams() {
  const { data, loading, error, reload } = useAsync(fetchTeams, [])
  const [form, setForm] = useState({ name: '', description: '' })
  const [editing, setEditing] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function run(action) {
    setActionError(null)
    try {
      await action()
      reload()
    } catch (err) {
      setActionError(errorText(err))
    }
  }

  const submitNew = (e) => {
    e.preventDefault()
    run(async () => {
      await createTeam({ name: form.name, ...(form.description && { description: form.description }) })
      setForm({ name: '', description: '' })
    })
  }

  if (loading && !data) return <p role="status">Loading teams…</p>
  if (error) return <p role="alert" className="error">{error.message} <button onClick={reload}>Retry</button></p>

  return (
    <div>
      <h1>Teams</h1>
      {actionError && <p role="alert" className="error">{actionError}</p>}
      <form className="card filters" onSubmit={submitNew} aria-label="Create team">
        <label>Name<input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required maxLength={80} /></label>
        <label>Description<input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} maxLength={300} /></label>
        <button type="submit" data-testid="create-team">Create team</button>
      </form>
      {data.items.length === 0 && <p className="card muted">No teams yet.</p>}
      <div className="grid-2">
        {data.items.map((t) => (
          <section className="card" key={t.id} aria-label={t.name}>
            {editing?.id === t.id ? (
              <form className="form" onSubmit={(e) => { e.preventDefault(); run(async () => { await updateTeam(t.id, { name: editing.name, description: editing.description }); setEditing(null) }) }}>
                <label>Name<input value={editing.name} onChange={(e) => setEditing((v) => ({ ...v, name: e.target.value }))} required /></label>
                <label>Description<input value={editing.description || ''} onChange={(e) => setEditing((v) => ({ ...v, description: e.target.value }))} /></label>
                <div className="row"><button type="submit">Save</button><button type="button" className="ghost" onClick={() => setEditing(null)}>Cancel</button></div>
              </form>
            ) : (
              <>
                <div className="row between"><h2>{t.name}</h2><span className="muted">{t._count?.incidents ?? 0} incidents</span></div>
                <p className="muted">{t.description || 'No description'}</p>
                <strong>Members ({t.members.length})</strong>
                {t.members.length === 0 ? <p className="muted">No members. Assign users to this team on the Users page.</p> : (
                  <ul>{t.members.map((m) => <li key={m.id}>{m.name} <span className="muted">{m.role}</span></li>)}</ul>
                )}
                <div className="row">
                  <button type="button" className="ghost" onClick={() => setEditing({ id: t.id, name: t.name, description: t.description })}>Edit</button>
                  <button type="button" className="danger" aria-label={`Delete ${t.name}`} onClick={() => window.confirm(`Delete team ${t.name}?`) && run(() => deleteTeam(t.id))}>Delete</button>
                </div>
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
