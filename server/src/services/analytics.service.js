import { prisma } from '../lib/prisma.js'
import { withSla } from './sla.service.js'

const DONE = ['RESOLVED', 'CLOSED']
const MIN = 60000
const dayKey = (d) => d.toISOString().slice(0, 10)
const avg = (nums) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0)

function dayBuckets(days) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  const map = new Map()
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    map.set(dayKey(d), 0)
  }
  return { start, map }
}

const toSeries = (map) => [...map].map(([date, count]) => ({ date, count }))

// Shared by the dashboard (/stats) and reports. Computed in JS from one bounded query so SLA states match the incident views.
export async function buildAnalytics(days = 30, trendDays = 14) {
  const now = new Date()
  const since = new Date(now.getTime() - days * 86400000)
  const select = {
    id: true, title: true, severity: true, status: true, category: true, createdAt: true, respondedAt: true, resolvedAt: true,
    responseDueAt: true, resolveDueAt: true, escalationLevel: true, assigneeId: true, teamId: true, assetId: true,
    assignee: { select: { id: true, name: true } }, asset: { select: { id: true, name: true } }, team: { select: { id: true, name: true } },
  }
  const [inPeriod, resolvedInPeriod, active] = await Promise.all([
    prisma.incident.findMany({ where: { createdAt: { gte: since } }, select, take: 5000 }),
    prisma.incident.findMany({ where: { resolvedAt: { gte: since } }, select, take: 5000 }),
    prisma.incident.findMany({ where: { status: { notIn: DONE } }, select, orderBy: { resolveDueAt: 'asc' }, take: 2000 }),
  ])

  const count = (list, key, keys) => {
    const out = keys ? Object.fromEntries(keys.map((k) => [k, 0])) : {}
    list.forEach((i) => {
      const v = i[key] ?? 'UNCATEGORIZED'
      out[v] = (out[v] || 0) + 1
    })
    return out
  }

  const periodWithSla = inPeriod.map((i) => withSla(i, now)).filter((i) => i.sla)
  const breached = periodWithSla.filter((i) => i.sla.overall === 'BREACHED').length
  const slaTotal = periodWithSla.length
  const activeSla = active.map((i) => withSla(i, now))

  const created = dayBuckets(trendDays)
  inPeriod.filter((i) => i.createdAt >= created.start).forEach((i) => created.map.set(dayKey(i.createdAt), (created.map.get(dayKey(i.createdAt)) ?? 0) + 1))
  const resolved = dayBuckets(trendDays)
  resolvedInPeriod.filter((i) => i.resolvedAt >= resolved.start).forEach((i) => resolved.map.set(dayKey(i.resolvedAt), (resolved.map.get(dayKey(i.resolvedAt)) ?? 0) + 1))

  const workload = new Map()
  active.filter((i) => i.assignee).forEach((i) => {
    const row = workload.get(i.assignee.id) || { user: i.assignee, active: 0 }
    row.active += 1
    workload.set(i.assignee.id, row)
  })
  const byTeam = new Map()
  active.filter((i) => i.team).forEach((i) => {
    const row = byTeam.get(i.team.id) || { teamId: i.team.id, name: i.team.name, active: 0 }
    row.active += 1
    byTeam.set(i.team.id, row)
  })
  const assets = new Map()
  inPeriod.filter((i) => i.asset).forEach((i) => {
    const row = assets.get(i.asset.id) || { assetId: i.asset.id, name: i.asset.name, count: 0 }
    row.count += 1
    assets.set(i.asset.id, row)
  })

  const tta = inPeriod.filter((i) => i.respondedAt).map((i) => (i.respondedAt - i.createdAt) / MIN)
  const ttr = resolvedInPeriod.map((i) => (i.resolvedAt - i.createdAt) / MIN)

  return {
    period: { from: since, to: now, days },
    totals: { created: inPeriod.length, resolved: resolvedInPeriod.length, active: active.length },
    kpis: {
      slaCompliancePct: slaTotal ? Math.round(((slaTotal - breached) / slaTotal) * 1000) / 10 : 100,
      mttaMinutes: avg(tta),
      mttrMinutes: avg(ttr),
      breached: activeSla.filter((i) => i.sla?.overall === 'BREACHED').length,
      atRisk: activeSla.filter((i) => i.sla?.overall === 'AT_RISK').length,
      escalated: active.filter((i) => i.escalationLevel > 0).length,
      resolvedLast30: resolvedInPeriod.length,
    },
    bySeverity: count(inPeriod, 'severity', ['SEV1', 'SEV2', 'SEV3', 'SEV4']),
    byCategory: count(active.concat(inPeriod.filter((i) => DONE.includes(i.status))), 'category'),
    sla: { met: slaTotal - breached, breached, compliancePct: slaTotal ? Math.round(((slaTotal - breached) / slaTotal) * 1000) / 10 : 100 },
    topAssets: [...assets.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    trend: toSeries(created.map),
    trendResolved: toSeries(resolved.map),
    workload: [...workload.values()].sort((a, b) => b.active - a.active),
    byTeam: [...byTeam.values()].sort((a, b) => b.active - a.active),
    slaWatchlist: activeSla.filter((i) => ['BREACHED', 'AT_RISK'].includes(i.sla?.overall)).sort((a, b) => a.sla.resolution.minutesRemaining - b.sla.resolution.minutesRemaining).slice(0, 8),
    activeSla,
  }
}
