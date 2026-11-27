import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { audit } from '../lib/audit.js'
import { badRequest, notFound } from '../lib/errors.js'
import { POLICIES, usedToday } from '../ai/governance.js'
import { llmEnabled } from '../ai/llm.js'
import { getObservability } from '../ai/observability.js'
import { findSimilar } from '../ai/similarity.js'
import { execute } from '../ai/agents/runner.js'
import { getAgent, describeAgents, rca, resolution, analysis } from '../ai/registry.js'
import { runEvals } from '../ai/evals/runner.js'
import { getSummary } from './report.service.js'
import { getSlaStatus } from './sla.service.js'

export const listAgents = () => ({ llmEnabled: llmEnabled(), model: llmEnabled() ? env.ai.model : null, items: describeAgents() })

// Run a single agent on an incident (the UI uses this to refresh one section without re-running the pipeline).
export async function runAgentOnIncident(user, incidentId, agentName) {
  const agent = getAgent(agentName)
  if (!agent) throw notFound(`Unknown agent: ${agentName}`)
  if (['sla-monitoring', 'reporting'].includes(agent.name)) throw badRequest(`${agent.name} does not run on a single incident`)

  const incident = await prisma.incident.findUnique({ where: { id: incidentId }, include: { asset: { select: { name: true, criticality: true } } } })
  if (!incident) throw notFound('Incident not found')
  const base = {
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    category: incident.category,
    assetName: incident.asset?.name,
    assetCriticality: incident.asset?.criticality,
  }

  let input = base
  if (agent === rca || agent === resolution) {
    const similar = await findSimilar(base, { excludeId: incidentId })
    input = { ...base, similar }
    if (agent === resolution && !base.category) input.category = (await execute(analysis, base, { user, persist: false, forceHeuristic: true })).output.category
  }
  return execute(agent, input, { user, incidentId })
}

export async function monitorSla(user) {
  const status = await getSlaStatus()
  const incidents = [...status.breached, ...status.atRisk].map((i) => ({
    id: i.id, title: i.title, severity: i.severity, status: i.status, assignee: i.assignee?.name ?? null, escalationLevel: i.escalationLevel, sla: i.sla,
  }))
  return execute(getAgent('sla-monitoring'), { incidents }, { user })
}

export async function executiveReport(user, days) {
  const summary = await getSummary(days)
  const result = await execute(getAgent('reporting'), summary, { user })
  return { ...result, summary }
}

export async function listRuns(incidentId) {
  const items = await prisma.agentRun.findMany({
    where: { incidentId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, traceId: true, agent: true, source: true, model: true, latencyMs: true, status: true, accepted: true, createdAt: true },
  })
  return { items }
}

export async function recordFeedback(user, runId, { accepted, rating, comment }) {
  const run = await prisma.agentRun.findUnique({ where: { id: runId }, select: { id: true } })
  if (!run) throw notFound('Agent run not found')
  await prisma.agentRun.update({ where: { id: runId }, data: { accepted, rating, feedbackNote: comment } })
  await audit(user.id, 'AGENT_FEEDBACK', 'AgentRun', runId, { accepted })
  return { ok: true }
}

export const observability = (days) => getObservability(days)

export async function governance() {
  const since = new Date(Date.now() - 7 * 86400000)
  const injectionFlags7d = await prisma.agentRun.count({ where: { createdAt: { gte: since }, flags: { has: 'prompt-injection-suspected' } } })
  return {
    llmEnabled: llmEnabled(),
    model: llmEnabled() ? env.ai.model : null,
    dailyLimit: env.ai.dailyCallLimit,
    usedToday: await usedToday(),
    injectionFlags7d,
    policies: POLICIES.map(({ id, title, description }) => ({ id, title, description })),
  }
}

export async function runAndStoreEvals(user, mode) {
  const report = await runEvals({ mode })
  const row = await prisma.agentEvalRun.create({ data: { mode, overall: report.overall, results: report.results, actorId: user.id } })
  await audit(user.id, 'AGENT_EVAL_RUN', 'AgentEvalRun', row.id, { mode, overall: report.overall })
  return { id: row.id, mode, overall: report.overall, results: report.results, createdAt: row.createdAt }
}

export async function listEvals() {
  const rows = await prisma.agentEvalRun.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
  return { items: rows.map(({ id, mode, overall, results, createdAt }) => ({ id, mode, overall, results, createdAt })) }
}
