import { useState } from 'react'

// Gallery of the Figma screen designs. Exported PNGs live in /public/designs/<file>.
// A screen whose PNG is missing shows a link to its frame in Figma instead; drop the
// PNG into public/designs with the listed file name and it appears automatically.
const FIGMA_FILE = 'https://www.figma.com/design/LybtewG0oxhBT1jnbO0YbY'

const SCREENS = [
  { file: 'login.png', title: 'Log in', route: '/login', node: '1-2' },
  { file: 'register.png', title: 'Register', route: '/register', node: '5-2' },
  { file: 'dashboard.png', title: 'Dashboard', route: '/', node: '5-220' },
  { file: 'incidents.png', title: 'Incidents', route: '/incidents', node: '5-29' },
  { file: 'report-incident.png', title: 'Report incident', route: '/incidents/new', node: '7-61' },
  { file: 'incident-detail.png', title: 'Incident detail', route: '/incidents/:id', node: '7-113' },
  { file: 'assets.png', title: 'Assets', route: '/assets', node: '7-253' },
  { file: 'notifications.png', title: 'Notifications', route: '/notifications', node: '7-399' },
  { file: 'reports.png', title: 'Reports', route: '/reports', node: '7-454' },
  { file: 'activity.png', title: 'Activity log', route: '/activity', node: '9-138' },
  { file: 'ai-ops.png', title: 'AI operations', route: '/ai-ops', node: '9-242' },
  { file: 'teams.png', title: 'Teams', route: '/teams', node: '9-445' },
  { file: 'users.png', title: 'Users', route: '/users', node: '9-520' },
]

function ScreenCard({ s }) {
  const [missing, setMissing] = useState(false)
  const figmaUrl = `${FIGMA_FILE}?node-id=${s.node}`
  return (
    <section className="card" aria-label={s.title}>
      <div className="row between"><h2>{s.title}</h2><span className="muted">{s.route}</span></div>
      {missing ? (
        <p className="muted">
          Not exported yet (expected <code>public/designs/{s.file}</code>).{' '}
          <a href={figmaUrl} target="_blank" rel="noreferrer">View in Figma</a>
        </p>
      ) : (
        <a href={`/designs/${s.file}`} target="_blank" rel="noreferrer">
          <img
            src={`/designs/${s.file}`}
            alt={`${s.title} design`}
            onError={() => setMissing(true)}
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 6 }}
          />
        </a>
      )}
    </section>
  )
}

export default function Designs() {
  return (
    <div>
      <div className="row between wrap">
        <h1>Figma screen designs</h1>
        <a className="button" href={FIGMA_FILE} target="_blank" rel="noreferrer">Open in Figma</a>
      </div>
      <p className="muted">Design exports of IncidentHub screens. Click a screen to view it full size.</p>
      <div className="grid-2">
        {SCREENS.map((s) => <ScreenCard key={s.file} s={s} />)}
      </div>
    </div>
  )
}
