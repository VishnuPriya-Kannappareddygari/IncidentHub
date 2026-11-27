import { useState } from 'react'
import { createUser, fetchUsers, updateUser } from '../api/incidents.js'
import { fetchTeams } from '../api/teams.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { errorText, ROLES } from '../utils/format.js'

const EMPTY = { name: '', email: '', password: '', role: 'RESPONDER', teamId: '' }

export default function Users() {
  const { user: me } = useAuth()
  const { data, loading, error, reload } = useAsync(fetchUsers, [])
  const { data: teams } = useAsync(() => fetchTeams().catch(() => ({ items: [] })), [])
  const [actionError, setActionError] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const set = (f) => (e) => setForm((v) => ({ ...v, [f]: e.target.value }))

  async function run(action) {
    setActionError(null)
    try {
      await action()
      reload()
    } catch (err) {
      setActionError(errorText(err))
    }
  }

  const create = (e) => {
    e.preventDefault()
    run(async () => {
      await createUser({ name: form.name, email: form.email, password: form.password, role: form.role, ...(form.teamId && { teamId: form.teamId }) })
      setForm(EMPTY)
    })
  }

  if (loading && !data) return <p role="status">Loading users…</p>
  if (error) return <p role="alert" className="error">{error.message}</p>

  return (
    <div>
      <h1>Users</h1>
      {actionError && <p role="alert" className="error">{actionError}</p>}

      <form className="card filters" onSubmit={create} aria-label="Create user">
        <label>Name<input value={form.name} onChange={set('name')} required maxLength={80} /></label>
        <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
        <label>Temporary password<input type="password" value={form.password} onChange={set('password')} required minLength={8} /></label>
        <label>Role<select value={form.role} onChange={set('role')}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
        <label>Team
          <select value={form.teamId} onChange={set('teamId')}>
            <option value="">No team</option>
            {(teams?.items || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <button type="submit" data-testid="create-user">Create user</button>
      </form>

      <div className="table-wrap">
        <table className="card table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Team</th><th>Active</th></tr></thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} className={u.isActive === false ? 'inactive' : ''}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select aria-label={`Role for ${u.name}`} value={u.role} disabled={u.id === me.id} onChange={(e) => run(() => updateUser(u.id, { role: e.target.value }))}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <select aria-label={`Team for ${u.name}`} value={u.teamId || ''} onChange={(e) => run(() => updateUser(u.id, { teamId: e.target.value || null }))}>
                    <option value="">No team</option>
                    {(teams?.items || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
                <td>
                  <button type="button" className={u.isActive === false ? '' : 'ghost'} disabled={u.id === me.id} onClick={() => run(() => updateUser(u.id, { isActive: u.isActive === false }))}>
                    {u.isActive === false ? 'Activate' : 'Deactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
