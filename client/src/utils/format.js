export const STATUSES = ['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED']
export const SEVERITIES = ['SEV1', 'SEV2', 'SEV3', 'SEV4']
export const ROLES = ['ADMIN', 'RESPONDER', 'REPORTER']
export const CATEGORIES = ['NETWORK', 'DATABASE', 'APPLICATION', 'SECURITY', 'INFRASTRUCTURE', 'ACCESS', 'EMAIL', 'PERFORMANCE', 'HARDWARE', 'OTHER']
export const ASSET_TYPES = ['SERVER', 'DATABASE', 'NETWORK', 'APPLICATION', 'ENDPOINT', 'CLOUD', 'OTHER']
export const ASSET_STATUSES = ['ACTIVE', 'MAINTENANCE', 'RETIRED']
export const CRITICALITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export const isStaff = (user) => user?.role === 'ADMIN' || user?.role === 'RESPONDER'
export const label = (value) => (value ? value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ') : '')
export const formatDate = (iso) => new Date(iso).toLocaleString()
export const actorName = (actor) => actor?.name || 'System'
export const errorText = (err) =>
  err.details?.length ? err.details.map((d) => `${d.path}: ${d.message}`).join('; ') : err.message

export function formatMinutes(min) {
  if (min == null) return '—'
  const abs = Math.abs(Math.round(min))
  const text =
    abs >= 1440 ? `${Math.floor(abs / 1440)}d ${Math.floor((abs % 1440) / 60)}h` : abs >= 60 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${abs}m`
  return min < 0 ? `${text} overdue` : text
}

export function describeEvent(event) {
  const d = event.data || {}
  switch (event.type) {
    case 'CREATED':
      return 'created the incident'
    case 'STATUS_CHANGED':
      return `changed status ${d.from} → ${d.to}`
    case 'SEVERITY_CHANGED':
      return `changed severity ${d.from} → ${d.to}`
    case 'ASSIGNED':
      return d.to ? 'changed the assignee' : 'unassigned the incident'
    case 'EDITED':
      return `edited ${(d.fields || []).join(' and ')}`
    case 'COMMENTED':
      return 'added a comment'
    case 'ACKNOWLEDGED':
      return 'acknowledged the incident'
    case 'ESCALATED':
      return `escalated the incident${d.level != null ? ` to level ${d.level}` : ''}${d.reason ? `: ${d.reason}` : ''}`
    case 'SLA_WARNING':
      return 'raised an SLA warning'
    case 'SLA_BREACHED':
      return 'recorded an SLA breach'
    case 'AI_ANALYZED':
      return 'ran AI analysis'
    case 'CATEGORY_CHANGED':
      return `changed category ${d.from ?? 'none'} → ${d.to ?? 'none'}`
    case 'RCA_UPDATED':
      return 'updated the root cause'
    case 'RESOLUTION_UPDATED':
      return 'updated the resolution notes'
    case 'ASSET_LINKED':
      return 'changed the linked asset'
    case 'TEAM_CHANGED':
      return 'changed the owning team'
    default:
      return label(event.type)
  }
}
