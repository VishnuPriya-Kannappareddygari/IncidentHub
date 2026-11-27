import { prisma } from '../lib/prisma.js'
import { audit } from '../lib/audit.js'
import { buildAnalytics } from './analytics.service.js'
import { withSla } from './sla.service.js'

export async function getSummary(days) {
  const { activeSla, workload, byTeam, slaWatchlist, trend, trendResolved, ...summary } = await buildAnalytics(days)
  return summary
}

// Spreadsheet formula injection guard: cells starting with = + - @ are prefixed with a quote.
const cell = (value) => {
  if (value === null || value === undefined) return ''
  let s = value instanceof Date ? value.toISOString() : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}
const toCsv = (header, rows) => [header.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n')

const dateRange = ({ from, to }) => ({ ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}) })

async function exportRows(filters) {
  const incidents = await prisma.incident.findMany({
    where: { ...(filters.status && { status: filters.status }), ...(filters.severity && { severity: filters.severity }), ...dateRange(filters) },
    include: { reporter: { select: { name: true } }, assignee: { select: { name: true } }, team: { select: { name: true } }, asset: { select: { name: true, assetTag: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  })
  return incidents.map((i) => withSla(i))
}

export async function incidentsCsv(actor, filters) {
  const rows = await exportRows(filters)
  await audit(actor.id, 'EXPORT_INCIDENTS', 'Report', null, { format: 'csv', count: rows.length })
  return toCsv(
    ['id', 'title', 'status', 'severity', 'category', 'reporter', 'assignee', 'team', 'asset', 'escalationLevel', 'slaState', 'createdAt', 'respondedAt', 'resolvedAt', 'rootCause', 'resolutionNotes'],
    rows.map((i) => [i.id, i.title, i.status, i.severity, i.category, i.reporter.name, i.assignee?.name, i.team?.name, i.asset?.name, i.escalationLevel, i.sla?.overall, i.createdAt, i.respondedAt, i.resolvedAt, i.rootCause, i.resolutionNotes]),
  )
}

export async function incidentsJson(actor, filters) {
  const rows = await exportRows(filters)
  await audit(actor.id, 'EXPORT_INCIDENTS', 'Report', null, { format: 'json', count: rows.length })
  return rows.map(({ description, ...i }) => i)
}

export async function slaCsv(actor, filters) {
  const rows = await exportRows(filters)
  await audit(actor.id, 'EXPORT_SLA', 'Report', null, { count: rows.length })
  return toCsv(
    ['id', 'title', 'severity', 'status', 'responseState', 'responseMinutesRemaining', 'resolutionState', 'resolutionMinutesRemaining', 'resolutionPercentElapsed', 'escalationLevel'],
    rows.filter((i) => i.sla).map((i) => [i.id, i.title, i.severity, i.status, i.sla.response.state, i.sla.response.minutesRemaining, i.sla.resolution.state, i.sla.resolution.minutesRemaining, i.sla.resolution.percentElapsed, i.escalationLevel]),
  )
}
