import { useState } from 'react'
import { createAsset, deleteAsset, fetchAssets, updateAsset } from '../api/assets.js'
import { fetchUsers } from '../api/incidents.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { ASSET_STATUSES, ASSET_TYPES, CRITICALITIES, errorText, isStaff, label } from '../utils/format.js'

const EMPTY = { name: '', assetTag: '', type: 'SERVER', status: 'ACTIVE', criticality: 'MEDIUM', environment: '', location: '', description: '', ownerId: '' }

function AssetForm({ initial, owners, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => {
    const base = { ...EMPTY }
    // Copy only editable fields so read-only ones (id, owner, _count) never reach the API.
    Object.keys(EMPTY).forEach((k) => { base[k] = initial?.[k] ?? EMPTY[k] })
    return base
  })
  const [error, setError] = useState(null)
  const set = (f) => (e) => setForm((v) => ({ ...v, [f]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError(null)
    const body = {}
    Object.entries(form).forEach(([k, v]) => {
      if (v !== '' || (initial && k !== 'assetTag')) body[k] = v === '' ? null : v
    })
    // Required fields must stay strings.
    body.name = form.name
    body.assetTag = form.assetTag
    try {
      await onSubmit(body)
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <form className="card form" onSubmit={submit} aria-label={initial ? 'Edit asset' : 'New asset'}>
      <h2>{initial ? `Edit ${initial.name}` : 'New asset'}</h2>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="filters">
        <label>Name<input value={form.name} onChange={set('name')} required maxLength={120} /></label>
        <label>Asset tag<input value={form.assetTag} onChange={set('assetTag')} required maxLength={40} /></label>
        <label>Type<select value={form.type} onChange={set('type')}>{ASSET_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
        <label>Status<select value={form.status} onChange={set('status')}>{ASSET_STATUSES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
        <label>Criticality<select value={form.criticality} onChange={set('criticality')}>{CRITICALITIES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
        <label>Environment<input value={form.environment || ''} onChange={set('environment')} placeholder="production" /></label>
        <label>Location<input value={form.location || ''} onChange={set('location')} /></label>
        <label>Owner
          <select value={form.ownerId} onChange={set('ownerId')}>
            <option value="">No owner</option>
            {owners.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
      </div>
      <label>Description<textarea value={form.description || ''} onChange={set('description')} rows={3} maxLength={2000} /></label>
      <div className="row"><button type="submit">Save asset</button><button type="button" className="ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  )
}

export default function Assets() {
  const { user } = useAuth()
  const staff = isStaff(user)
  const [filters, setFilters] = useState({ q: '', type: '', status: '' })
  const [editing, setEditing] = useState(null) // null | 'new' | asset
  const [actionError, setActionError] = useState(null)
  const { data, loading, error, reload } = useAsync(() => fetchAssets(filters), [filters.q, filters.type, filters.status])
  const { data: users } = useAsync(() => (staff ? fetchUsers() : Promise.resolve([])), [staff])
  const owners = (users || []).filter((u) => u.role !== 'REPORTER')
  const setF = (f) => (e) => setFilters((v) => ({ ...v, [f]: e.target.value }))

  async function save(body) {
    if (editing === 'new') await createAsset(body)
    else await updateAsset(editing.id, body)
    setEditing(null)
    reload()
  }

  async function remove(asset) {
    if (!window.confirm(`Delete asset ${asset.name}?`)) return
    setActionError(null)
    try {
      await deleteAsset(asset.id)
      reload()
    } catch (err) {
      setActionError(err.message)
    }
  }

  return (
    <div>
      <div className="row between">
        <h1>Assets</h1>
        {staff && <button type="button" data-testid="new-asset" onClick={() => setEditing('new')}>Add asset</button>}
      </div>
      {editing && <AssetForm initial={editing === 'new' ? null : editing} owners={owners} onSubmit={save} onCancel={() => setEditing(null)} />}
      <div className="card filters">
        <label>Search<input type="search" value={filters.q} onChange={setF('q')} placeholder="Name or tag" /></label>
        <label>Type<select value={filters.type} onChange={setF('type')}><option value="">All</option>{ASSET_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
        <label>Status<select value={filters.status} onChange={setF('status')}><option value="">All</option>{ASSET_STATUSES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
      </div>
      {actionError && <p role="alert" className="error">{actionError}</p>}
      {loading && !data && <p role="status">Loading assets…</p>}
      {error && <p role="alert" className="error">{error.message} <button onClick={reload}>Retry</button></p>}
      {data && data.items.length === 0 && <p className="card muted">No assets found.</p>}
      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table className="card table" data-testid="asset-table">
            <thead><tr><th>Tag</th><th>Name</th><th>Type</th><th>Status</th><th>Criticality</th><th>Env</th><th>Owner</th><th>Incidents</th>{staff && <th>Actions</th>}</tr></thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td>{a.assetTag}</td><td>{a.name}</td><td>{label(a.type)}</td>
                  <td><span className={`badge asset-${a.status}`}>{label(a.status)}</span></td>
                  <td><span className={`badge crit-${a.criticality}`}>{label(a.criticality)}</span></td>
                  <td>{a.environment || '—'}</td><td>{a.owner?.name || '—'}</td><td>{a._count?.incidents ?? 0}</td>
                  {staff && (
                    <td className="row">
                      <button type="button" className="ghost" aria-label={`Edit ${a.name}`} onClick={() => setEditing(a)}>Edit</button>
                      {user.role === 'ADMIN' && <button type="button" className="danger" aria-label={`Delete ${a.name}`} onClick={() => remove(a)}>Delete</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
