import crypto from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { notFound } from '../lib/errors.js'
import { execute } from './agents/runner.js'
import { findSimilar } from './similarity.js'
import { analysis, priority, rca, resolution } from './registry.js'

async function loadContext(incidentId) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: { asset: { select: { name: true, criticality: true } } },
  })
  if (!incident) throw notFound('Incident not found')
  return {
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    category: incident.category,
    assetName: incident.asset?.name,
    assetCriticality: incident.asset?.criticality,
  }
}

// Pipeline: [analysis || priority || similar-search] -> root-cause -> resolution.
// Independent steps run in parallel; later agents receive earlier outputs as context.
export async function analyzeIncident(user, incidentId) {
  const traceId = crypto.randomUUID()
  const base = await loadContext(incidentId)
  const ctx = { user, incidentId, traceId }

  const [analysisResult, priorityResult, similar] = await Promise.all([
    execute(analysis, base, ctx),
    execute(priority, base, ctx),
    findSimilar(base, { excludeId: incidentId }),
  ])

  const enriched = { ...base, category: base.category || analysisResult.output.category, analysis: analysisResult.output, similar }
  const rootCause = await execute(rca, enriched, ctx)
  const resolutionResult = await execute(resolution, { ...enriched, rootCause: rootCause.output }, ctx)

  // The summary is informational and non-destructive; every other suggestion waits for a human click.
  await prisma.$transaction([
    prisma.incident.update({ where: { id: incidentId }, data: { aiSummary: analysisResult.output.summary } }),
    prisma.incidentEvent.create({ data: { incidentId, actorId: user?.id ?? null, type: 'AI_ANALYZED', data: { traceId } } }),
  ])

  return { traceId, results: { analysis: analysisResult, priority: priorityResult, rootCause, resolution: resolutionResult }, similar }
}

// Lightweight preview used while filling in the "new incident" form (nothing is stored on an incident).
export async function triage(user, { title, description, assetId }) {
  const traceId = crypto.randomUUID()
  const asset = assetId ? await prisma.asset.findUnique({ where: { id: assetId }, select: { name: true, criticality: true } }) : null
  const base = { title, description, assetName: asset?.name, assetCriticality: asset?.criticality }
  const ctx = { user, traceId }
  const [analysisResult, priorityResult, similar] = await Promise.all([execute(analysis, base, ctx), execute(priority, base, ctx), findSimilar({ title, description })])
  return { traceId, results: { analysis: analysisResult, priority: priorityResult }, similar }
}

// Best-effort background run when an incident is created. Failures are logged, never surfaced.
export function autoAnalyze(incidentId) {
  analyzeIncident(null, incidentId).catch((err) =>
    console.error(JSON.stringify({ level: 'error', event: 'auto_analyze_failed', incidentId, message: err?.message })),
  )
}
