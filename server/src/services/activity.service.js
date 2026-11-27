import { prisma } from '../lib/prisma.js'

const actorSelect = { select: { id: true, name: true } }

// One merged, newest-first feed across incident events, administrative audit logs and agent runs.
export async function listActivity({ limit, source }) {
  const want = (s) => !source || source === s
  const [events, audits, runs] = await Promise.all([
    want('incident')
      ? prisma.incidentEvent.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { actor: actorSelect, incident: { select: { id: true, title: true } } } })
      : [],
    want('audit') ? prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { actor: actorSelect } }) : [],
    want('agent')
      ? prisma.agentRun.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { actor: actorSelect, incident: { select: { id: true, title: true } } } })
      : [],
  ])

  const items = [
    ...events.map((e) => ({ id: e.id, source: 'incident', type: e.type, actor: e.actor, incidentId: e.incidentId, incidentTitle: e.incident?.title ?? null, data: e.data, createdAt: e.createdAt })),
    ...audits.map((a) => ({ id: a.id, source: 'audit', type: a.action, actor: a.actor, incidentId: null, incidentTitle: null, data: { entity: a.entity, entityId: a.entityId, ...(a.data ?? {}) }, createdAt: a.createdAt })),
    ...runs.map((r) => ({ id: r.id, source: 'agent', type: r.agent, actor: r.actor, incidentId: r.incidentId, incidentTitle: r.incident?.title ?? null, data: { source: r.source, latencyMs: r.latencyMs, status: r.status }, createdAt: r.createdAt })),
  ]
  return { items: items.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit) }
}
