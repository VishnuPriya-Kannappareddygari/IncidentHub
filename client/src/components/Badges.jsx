import { label } from '../utils/format.js'

export const StatusBadge = ({ status }) => <span className={`badge status-${status}`}>{label(status)}</span>
export const SeverityBadge = ({ severity }) => <span className={`badge sev-${severity}`}>{severity}</span>
export const CategoryBadge = ({ category }) =>
  category ? <span className="badge cat">{label(category)}</span> : <span className="muted">Uncategorised</span>
export const SlaBadge = ({ state }) =>
  state ? <span className={`badge sla-${state}`} data-testid="sla-badge">{label(state)}</span> : <span className="muted">—</span>
export const SourceBadge = ({ source }) => (
  <span className={`badge src-${source}`} title="Where this output came from">{source === 'claude' ? 'Claude' : label(source)}</span>
)
