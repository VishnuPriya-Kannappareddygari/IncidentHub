import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { isStaff } from '../utils/format.js'
import NotificationBell from './NotificationBell.jsx'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const staff = isStaff(user)

  return (
    <header className="navbar">
      <Link to="/" className="brand">IncidentHub</Link>
      {user ? (
        <nav aria-label="Main">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/incidents" end>Incidents</NavLink>
          <NavLink to="/incidents/new">Report</NavLink>
          <NavLink to="/assets">Assets</NavLink>
          {staff && <NavLink to="/reports">Reports</NavLink>}
          {staff && <NavLink to="/activity">Activity</NavLink>}
          {staff && <NavLink to="/ai-ops">AI Ops</NavLink>}
          {user.role === 'ADMIN' && <NavLink to="/teams">Teams</NavLink>}
          {user.role === 'ADMIN' && <NavLink to="/users">Users</NavLink>}
          <NavLink to="/designs">Designs</NavLink>
          <NotificationBell />
          <span className="muted" data-testid="current-user">{user.name} ({user.role})</span>
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            Log out
          </button>
        </nav>
      ) : (
        <nav aria-label="Main">
          <NavLink to="/designs">Designs</NavLink>
          <NavLink to="/login">Log in</NavLink>
          <NavLink to="/register">Register</NavLink>
        </nav>
      )}
    </header>
  )
}
