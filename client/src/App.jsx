import { Navigate, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import ActivityLog from './pages/ActivityLog.jsx'
import AiOps from './pages/AiOps.jsx'
import Assets from './pages/Assets.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Designs from './pages/Designs.jsx'
import IncidentDetail from './pages/IncidentDetail.jsx'
import IncidentList from './pages/IncidentList.jsx'
import Login from './pages/Login.jsx'
import NewIncident from './pages/NewIncident.jsx'
import Notifications from './pages/Notifications.jsx'
import Register from './pages/Register.jsx'
import Reports from './pages/Reports.jsx'
import Teams from './pages/Teams.jsx'
import Users from './pages/Users.jsx'

const STAFF = ['ADMIN', 'RESPONDER']

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/designs" element={<Designs />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/incidents" element={<RequireAuth><IncidentList /></RequireAuth>} />
          <Route path="/incidents/new" element={<RequireAuth><NewIncident /></RequireAuth>} />
          <Route path="/incidents/:id" element={<RequireAuth><IncidentDetail /></RequireAuth>} />
          <Route path="/assets" element={<RequireAuth><Assets /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="/reports" element={<RequireAuth roles={STAFF}><Reports /></RequireAuth>} />
          <Route path="/activity" element={<RequireAuth roles={STAFF}><ActivityLog /></RequireAuth>} />
          <Route path="/ai-ops" element={<RequireAuth roles={STAFF}><AiOps /></RequireAuth>} />
          <Route path="/teams" element={<RequireAuth roles={['ADMIN']}><Teams /></RequireAuth>} />
          <Route path="/users" element={<RequireAuth roles={['ADMIN']}><Users /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
