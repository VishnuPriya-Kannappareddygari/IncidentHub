import { prisma } from '../lib/prisma.js'
import { env } from '../config/env.js'
import { usedToday } from './governance.js'

// Persists a run and emits one structured log line. Never throws: telemetry must not break a request.
export async function recordRun({ traceId, agent, incidentId, actorId, source, model, latencyMs, tokensIn, tokensOut, flags, output, error, input }) {
  console.log(JSON.stringify({ level: 'info', event: 'agent_run', traceId, agent, incidentId, source, model, latencyMs, tokensIn, tokensOut, flags, error: error || undefined }))
  try {
    const run = await prisma.agentRun.create({
      data: {
        traceId,
        agent,
        incidentId,
        actorId,
        source,
        model,
        status: error && source !== 'heuristic-fallback' ? 'error' : 'ok',
        latencyMs,
        tokensIn,
        tokensOut,
        flags,
        error,
        output,
        inputPreview: `${input.title ?? ''} | ${String(input.description ?? '').slice(0, 160)}`.slice(0, 240),
      },
      select: { id: true },
    })
    return run.id
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', event: 'agent_run_persist_failed', message: err?.message }))
    return null
  }
}

const pct = (n, d) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10)

export async function getObservability(days = 7) {
  const since = new Date(Date.now() - days * 86400000)
  const runs = await prisma.agentRun.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, agent: true, source: true, status: true, latencyMs: true, tokensIn: true, tokensOut: true, accepted: true, flags: true, error: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })

  const summarize = (list) => {
    const judged = list.filter((r) => r.accepted !== null)
    return {
      runs: list.length,
      successRate: pct(list.filter((r) => r.status === 'ok').length, list.length),
      fallbackRate: pct(list.filter((r) => r.source === 'heuristic-fallback').length, list.length),
      avgLatencyMs: list.length ? Math.round(list.reduce((s, r) => s + r.latencyMs, 0) / list.length) : 0,
      acceptanceRate: pct(judged.filter((r) => r.accepted).length, judged.length),
    }
  }

  const agents = [...new Set(runs.map((r) => r.agent))].sort()
  const daily = new Map()
  for (const r of runs) {
    const key = r.createdAt.toISOString().slice(0, 10)
    const row = daily.get(key) || { date: key, runs: 0, errors: 0 }
    row.runs += 1
    if (r.status !== 'ok') row.errors += 1
    daily.set(key, row)
  }

  return {
    totals: { ...summarize(runs), tokensIn: runs.reduce((s, r) => s + r.tokensIn, 0), tokensOut: runs.reduce((s, r) => s + r.tokensOut, 0) },
    byAgent: agents.map((agent) => ({ agent, ...summarize(runs.filter((r) => r.agent === agent)) })),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    recent: runs.slice(0, 15).map(({ id, agent, source, status, latencyMs, createdAt, error }) => ({ id, agent, source, status, latencyMs, createdAt, error })),
    budget: { used: await usedToday(), limit: env.ai.dailyCallLimit },
    injectionFlags7d: runs.filter((r) => r.flags.includes('prompt-injection-suspected')).length,
  }
}
