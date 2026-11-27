import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { autoAnalyze } from '../ai/orchestrator.js'
import { findSimilar } from '../ai/similarity.js'
import { MAX_ESCALATION, computeDueDates, escalateIncident, withSla } from './sla.service.js'
import { notifyUsers } from './notification.service.js'

const userSelect = { id: true, name: true, email: true, role: true }

const listSelect = {
  id: true,
  title: true,
  status: true,
  severity: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  respondedAt: true,
  resolvedAt: true,
  responseDueAt: true,
  resolveDueAt: true,
  escalationLevel: true,
  reporter: { select: userSelect },
  assignee: { select: userSelect },
  team: { select: { id: true, name: true } },
  asset: { select: { id: true, name: true, assetTag: true } },
  _count: { select: { comments: true } },
}

// Allowed status lifecycle; anything else is a 409.
const TRANSITIONS = {
  OPEN: ['INVESTIGATING', 'CLOSED'],
  INVESTIGATING: ['MITIGATED', 'RESOLVED', 'OPEN'],
  MITIGATED: ['RESOLVED', 'INVESTIGATING'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
}
const DONE = ['RESOLVED', 'CLOSED']

const isStaff = (user) => user.role === 'ADMIN' || user.role === 'RESPONDER'
const STAFF_FIELDS = ['status', 'severity', 'assigneeId', 'category', 'assetId', 'teamId', 'rootCause', 'resolutionNotes']

export async function listIncidents(query) {
  const { page, pageSize, status, severity, category, assigneeId, teamId, assetId, sla, escalated, q, sortBy, order } = query
  const now = new Date()
  const where = {
    ...(status && { status }),
    ...(severity && { severity }),
    ...(category && { category }),
    ...(teamId && { teamId }),
    ...(assetId && { assetId }),
    ...(escalated && { escalationLevel: { gt: 0 } }),
    ...(assigneeId && { assigneeId: assigneeId === 'unassigned' ? null : assigneeId }),
    ...(sla === 'breached' && { status: { notIn: DONE }, resolveDueAt: { lt: now } }),
    // At risk = not yet breached and past 75% of the resolve window; filtered precisely after the query below.
    ...(sla === 'at_risk' && { status: { notIn: DONE }, resolveDueAt: { gte: now } }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    }),
  }

  if (sla === 'at_risk') {
    const candidates = await prisma.incident.findMany({ where, select: listSelect, orderBy: { resolveDueAt: 'asc' } })
    const atRisk = candidates.map((i) => withSla(i, now)).filter((i) => i.sla?.overall === 'AT_RISK')
    return { items: atRisk.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: atRisk.length, totalPages: Math.max(1, Math.ceil(atRisk.length / pageSize)) }
  }

  const [total, items] = await prisma.$transaction([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      select: listSelect,
      orderBy: { [sortBy]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return { items: items.map((i) => withSla(i, now)), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getIncident(id) {
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      reporter: { select: userSelect },
      assignee: { select: userSelect },
      team: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true, assetTag: true, criticality: true } },
      comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: userSelect } } },
      events: { orderBy: { createdAt: 'desc' }, include: { actor: { select: userSelect } } },
    },
  })
  if (!incident) throw notFound('Incident not found')
  return withSla(incident)
}

export const getSimilarIncidents = async (id) => {
  const incident = await prisma.incident.findUnique({ where: { id }, select: { title: true, description: true } })
  if (!incident) throw notFound('Incident not found')
  return { items: await findSimilar(incident, { excludeId: id }) }
}

export async function createIncident(user, input) {
  const dues = computeDueDates(input.severity, new Date())
  const created = await prisma.incident.create({
    data: {
      ...input,
      ...dues,
      reporterId: user.id,
      events: { create: { actorId: user.id, type: 'CREATED', data: { severity: input.severity } } },
    },
    select: listSelect,
  })
  if (env.ai.autoAnalyze) autoAnalyze(created.id)
  return withSla(created)
}

export async function updateIncident(user, id, input) {
  const current = await prisma.incident.findUnique({ where: { id } })
  if (!current) throw notFound('Incident not found')

  const staff = isStaff(user)
  if (!staff && STAFF_FIELDS.some((f) => f in input)) {
    throw forbidden('Only responders and admins can change status, severity, assignee, category, asset, team or analysis fields')
  }
  if (!staff && current.reporterId !== user.id) throw forbidden('You can only edit your own incidents')

  const events = []
  const data = {}
  const notify = []

  if (input.title !== undefined && input.title !== current.title) data.title = input.title
  if (input.description !== undefined && input.description !== current.description) data.description = input.description
  if (data.title || data.description) events.push({ type: 'EDITED', data: { fields: Object.keys(data) } })

  if (input.severity && input.severity !== current.severity) {
    data.severity = input.severity
    // SLA windows follow severity, measured from when the incident was created.
    Object.assign(data, computeDueDates(input.severity, current.createdAt), { slaWarnedAt: null })
    events.push({ type: 'SEVERITY_CHANGED', data: { from: current.severity, to: input.severity } })
  }

  if (input.status && input.status !== current.status) {
    if (!TRANSITIONS[current.status].includes(input.status)) {
      throw conflict(`Cannot move an incident from ${current.status} to ${input.status}`)
    }
    data.status = input.status
    data.resolvedAt = DONE.includes(input.status) ? current.resolvedAt ?? new Date() : null
    if (!current.respondedAt) data.respondedAt = new Date()
    events.push({ type: 'STATUS_CHANGED', data: { from: current.status, to: input.status } })
  }

  if (input.assigneeId !== undefined && input.assigneeId !== current.assigneeId) {
    if (input.assigneeId !== null) {
      const assignee = await prisma.user.findUnique({ where: { id: input.assigneeId } })
      if (!assignee) throw badRequest('Assignee does not exist')
      if (assignee.role === 'REPORTER') throw badRequest('Incidents can only be assigned to responders or admins')
      if (!assignee.isActive) throw badRequest('Assignee account is deactivated')
      if (assignee.id !== user.id) notify.push(assignee.id)
    }
    data.assigneeId = input.assigneeId
    events.push({ type: 'ASSIGNED', data: { from: current.assigneeId, to: input.assigneeId } })
  }

  if (input.category !== undefined && input.category !== current.category) {
    data.category = input.category
    events.push({ type: 'CATEGORY_CHANGED', data: { from: current.category, to: input.category } })
  }
  if (input.assetId !== undefined && input.assetId !== current.assetId) {
    data.assetId = input.assetId
    events.push({ type: 'ASSET_LINKED', data: { from: current.assetId, to: input.assetId } })
  }
  if (input.teamId !== undefined && input.teamId !== current.teamId) {
    data.teamId = input.teamId
    events.push({ type: 'TEAM_CHANGED', data: { from: current.teamId, to: input.teamId } })
  }
  if (input.rootCause !== undefined && input.rootCause !== current.rootCause) {
    data.rootCause = input.rootCause
    events.push({ type: 'RCA_UPDATED' })
  }
  if (input.resolutionNotes !== undefined && input.resolutionNotes !== current.resolutionNotes) {
    data.resolutionNotes = input.resolutionNotes
    events.push({ type: 'RESOLUTION_UPDATED' })
  }

  if (events.length === 0) return getIncident(id)

  await prisma.incident.update({
    where: { id },
    data: { ...data, events: { create: events.map((e) => ({ ...e, actorId: user.id })) } },
  })
  if (notify.length) await notifyUsers(notify, { type: 'ASSIGNED', title: `Incident #${id} assigned to you`, body: current.title, incidentId: id })
  return getIncident(id)
}

// First response: records respondedAt (stops the response SLA clock), self-assigns if unowned, starts investigation.
export async function acknowledgeIncident(user, id) {
  const current = await prisma.incident.findUnique({ where: { id } })
  if (!current) throw notFound('Incident not found')
  if (current.respondedAt) throw conflict('Incident has already been acknowledged')
  if (DONE.includes(current.status)) throw conflict('Incident is already resolved or closed')

  await prisma.incident.update({
    where: { id },
    data: {
      respondedAt: new Date(),
      ...(current.assigneeId ? {} : { assigneeId: user.id }),
      ...(current.status === 'OPEN' ? { status: 'INVESTIGATING' } : {}),
      events: { create: { actorId: user.id, type: 'ACKNOWLEDGED' } },
    },
  })
  return getIncident(id)
}

export async function escalate(user, id, reason) {
  const current = await prisma.incident.findUnique({ where: { id } })
  if (!current) throw notFound('Incident not found')
  if (DONE.includes(current.status)) throw conflict('Resolved or closed incidents cannot be escalated')
  if (current.escalationLevel >= MAX_ESCALATION) throw conflict('Incident is already at the maximum escalation level')
  await escalateIncident(current, { actorId: user.id, reason })
  return getIncident(id)
}
