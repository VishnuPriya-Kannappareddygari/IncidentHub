import { prisma } from '../lib/prisma.js'
import { notifyUsers } from './notification.service.js'

// Minutes allowed to respond / resolve per severity.
export const SLA_POLICIES = [
  { severity: 'SEV1', responseMinutes: 15, resolveMinutes: 240 },
  { severity: 'SEV2', responseMinutes: 30, resolveMinutes: 480 },
  { severity: 'SEV3', responseMinutes: 120, resolveMinutes: 1440 },
  { severity: 'SEV4', responseMinutes: 480, resolveMinutes: 4320 },
]
const policyFor = (severity) => SLA_POLICIES.find((p) => p.severity === severity)
const AT_RISK_RATIO = 0.75
export const MAX_ESCALATION = 3
const DONE = ['RESOLVED', 'CLOSED']
const MIN = 60000

export function computeDueDates(severity, from) {
  const p = policyFor(severity)
  return { responseDueAt: new Date(from.getTime() + p.responseMinutes * MIN), resolveDueAt: new Date(from.getTime() + p.resolveMinutes * MIN) }
}

// One timer: how far through its window is it, and what is its state?
function timer({ start, due, doneAt, now }) {
  const total = due - start
  const end = doneAt ?? now
  const percentElapsed = total > 0 ? Math.round(((end - start) / total) * 100) : 100
  const minutesRemaining = Math.round((due - now) / MIN)
  let state = 'ON_TRACK'
  if (doneAt) state = doneAt <= due ? 'MET' : 'BREACHED'
  else if (now > due) state = 'BREACHED'
  else if (percentElapsed >= AT_RISK_RATIO * 100) state = 'AT_RISK'
  return { state, minutesRemaining: doneAt ? 0 : minutesRemaining, percentElapsed: Math.min(percentElapsed, 999) }
}

// Computed on read so it is always current; stored timestamps (slaWarnedAt/slaBreachedAt) only dedupe alerts.
export function computeSla(incident, now = new Date()) {
  if (!incident.createdAt || !incident.severity) return null
  const start = new Date(incident.createdAt).getTime()
  const t = now.getTime()
  // Incidents created before SLA tracking have no stored due dates: derive them from the policy.
  const fallback = computeDueDates(incident.severity, new Date(start))
  const responseDue = new Date(incident.responseDueAt ?? fallback.responseDueAt).getTime()
  const resolveDue = new Date(incident.resolveDueAt ?? fallback.resolveDueAt).getTime()
  const response = timer({ start, due: responseDue, doneAt: incident.respondedAt ? new Date(incident.respondedAt).getTime() : null, now: t })
  const resolution = timer({ start, due: resolveDue, doneAt: incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : null, now: t })
  const rank = { BREACHED: 3, AT_RISK: 2, ON_TRACK: 1, MET: 0 }
  const overall = [response, resolution].sort((a, b) => rank[b.state] - rank[a.state])[0].state
  return { response, resolution, overall }
}

export const withSla = (incident, now) => ({ ...incident, sla: computeSla(incident, now) })

export const listPolicies = () => SLA_POLICIES

const slaSelect = {
  id: true, title: true, severity: true, status: true, category: true, createdAt: true, respondedAt: true, resolvedAt: true,
  responseDueAt: true, resolveDueAt: true, escalationLevel: true,
  assignee: { select: { id: true, name: true } }, asset: { select: { id: true, name: true } },
}

export async function getSlaStatus() {
  const active = await prisma.incident.findMany({ where: { status: { notIn: DONE } }, select: slaSelect, orderBy: { resolveDueAt: 'asc' } })
  const enriched = active.map((i) => withSla(i)).filter((i) => i.sla)
  const breached = enriched.filter((i) => i.sla.overall === 'BREACHED')
  const atRisk = enriched.filter((i) => i.sla.overall === 'AT_RISK')
  return { counts: { breached: breached.length, atRisk: atRisk.length, onTrack: enriched.length - breached.length - atRisk.length }, breached, atRisk }
}

const NOTIFY_ROLES = { 1: ['RESPONDER'], 2: ['ADMIN'], 3: ['ADMIN'] }

// Raises an incident one escalation level, records the event and notifies the right audience.
export async function escalateIncident(incident, { actorId = null, reason }) {
  const level = Math.min(incident.escalationLevel + 1, MAX_ESCALATION)
  const recipients = await prisma.user.findMany({ where: { role: { in: NOTIFY_ROLES[level] }, isActive: true }, select: { id: true } })
  const ids = new Set(recipients.map((r) => r.id))
  if (level === 3) ids.add(incident.reporterId)
  if (incident.assigneeId) ids.add(incident.assigneeId)

  await prisma.$transaction([
    prisma.incident.update({ where: { id: incident.id }, data: { escalationLevel: level } }),
    prisma.incidentEvent.create({ data: { incidentId: incident.id, actorId, type: 'ESCALATED', data: { from: incident.escalationLevel, to: level, reason } } }),
  ])
  await notifyUsers([...ids], { type: 'ESCALATION', title: `Incident #${incident.id} escalated to level ${level}`, body: reason, incidentId: incident.id })
  return level
}

// Periodic sweep: warn once at risk, breach once overdue (auto-escalating one level). Idempotent via slaWarnedAt/slaBreachedAt.
export async function runSlaSweep(now = new Date()) {
  const active = await prisma.incident.findMany({ where: { status: { notIn: DONE } } })
  let warned = 0
  let breached = 0
  let escalated = 0

  for (const incident of active) {
    const sla = computeSla(incident, now)
    if (!sla) continue

    if (sla.overall === 'BREACHED' && !incident.slaBreachedAt) {
      await prisma.$transaction([
        prisma.incident.update({ where: { id: incident.id }, data: { slaBreachedAt: now } }),
        prisma.incidentEvent.create({ data: { incidentId: incident.id, actorId: null, type: 'SLA_BREACHED', data: { response: sla.response.state, resolution: sla.resolution.state } } }),
      ])
      breached += 1
      const staff = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'RESPONDER'] }, isActive: true }, select: { id: true } })
      await notifyUsers(staff.map((s) => s.id), { type: 'SLA_BREACH', title: `SLA breached on incident #${incident.id}`, body: incident.title, incidentId: incident.id })
      if (incident.escalationLevel < MAX_ESCALATION) {
        await escalateIncident(incident, { reason: 'Automatic escalation: SLA breached' })
        escalated += 1
      }
    } else if (sla.overall === 'AT_RISK' && !incident.slaWarnedAt && !incident.slaBreachedAt) {
      await prisma.$transaction([
        prisma.incident.update({ where: { id: incident.id }, data: { slaWarnedAt: now } }),
        prisma.incidentEvent.create({ data: { incidentId: incident.id, actorId: null, type: 'SLA_WARNING', data: { resolutionMinutesRemaining: sla.resolution.minutesRemaining } } }),
      ])
      warned += 1
      const targets = incident.assigneeId ? [incident.assigneeId] : (await prisma.user.findMany({ where: { role: 'RESPONDER', isActive: true }, select: { id: true } })).map((u) => u.id)
      await notifyUsers(targets, { type: 'SLA_WARNING', title: `Incident #${incident.id} is at risk of breaching SLA`, body: incident.title, incidentId: incident.id })
    }
  }
  return { warned, breached, escalated }
}

export function startSlaSweeper(intervalSeconds) {
  const timerId = setInterval(() => {
    runSlaSweep().catch((err) => console.error(JSON.stringify({ level: 'error', event: 'sla_sweep_failed', message: err?.message })))
  }, intervalSeconds * 1000)
  timerId.unref()
  return timerId
}
