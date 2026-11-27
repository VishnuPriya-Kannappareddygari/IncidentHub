import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Shared form for login and register; `mode` switches the fields and action.
export default function AuthForm({ mode }) {
  const isRegister = mode === 'register'
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (isRegister) await register(form)
      else await login({ email: form.email, password: form.password })
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.details?.length ? `${err.message}: ${err.details.map((d) => `${d.path} ${d.message}`).join('; ')}` : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card form narrow" onSubmit={onSubmit}>
      <h1>{isRegister ? 'Create account' : 'Log in'}</h1>
      {error && <p role="alert" className="error">{error}</p>}
      {isRegister && (
        <label>Name<input value={form.name} onChange={set('name')} required maxLength={80} /></label>
      )}
      <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
      <label>
        Password
        <input type="password" value={form.password} onChange={set('password')} required minLength={isRegister ? 8 : 1} />
      </label>
      <button type="submit" disabled={submitting}>{isRegister ? 'Register' : 'Log in'}</button>
      <p className="muted">
        {isRegister ? <>Have an account? <Link to="/login">Log in</Link></> : <>No account? <Link to="/register">Register</Link></>}
      </p>
    </form>
  )
}
