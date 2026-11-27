import { getAgent } from '../registry.js'
import { execute } from '../agents/runner.js'
import { CASES } from './cases.js'

const SEV = ['SEV1', 'SEV2', 'SEV3', 'SEV4']
const flat = (value) => JSON.stringify(value).toLowerCase()

// Each scorer returns 0..1. Severity allows partial credit for being one level off.
const SCORERS = {
  'incident-analysis': (c, out) => (out.category === c.category ? 1 : 0),
  'priority-classification': (c, out) => {
    const gap = Math.abs(SEV.indexOf(out.severity) - SEV.indexOf(c.severity))
    return gap === 0 ? 1 : gap === 1 ? 0.5 : 0
  },
  'root-cause-analysis': (c, out) => (c.anyOf.some((k) => flat(out.hypotheses.slice(0, 2)).includes(k)) ? 1 : 0),
  'resolution-recommendation': (c, out) => (c.anyOf.some((k) => flat(out.steps).includes(k)) ? 1 : 0),
  'sla-monitoring': (c, out) => {
    const countsOk = Object.entries(c.counts).every(([k, v]) => out.overall[k] === v)
    const mentionsOk = c.mustMention.every((id) => out.items.some((i) => i.incidentId === id) )
    return countsOk && mentionsOk ? 1 : 0
  },
  reporting: (c, out) => (c.mustInclude.every((k) => flat(out).includes(k)) ? 1 : 0),
}

const PASS_THRESHOLD = 0.75

// mode 'heuristic' is offline and deterministic (CI-safe); 'live' lets agents use Claude when configured.
export async function runEvals({ mode = 'heuristic', agent } = {}) {
  const forceHeuristic = mode !== 'live'
  const cases = CASES.filter((c) => !agent || c.agent === agent)
  const perAgent = new Map()

  for (const c of cases) {
    const a = getAgent(c.agent)
    let score = 0
    let detail = ''
    let source = 'heuristic'
    let latencyMs = 0
    try {
      const res = await execute(a, c.input, { persist: false, forceHeuristic })
      source = res.source
      latencyMs = res.latencyMs
      score = SCORERS[c.agent](c, res.output)
    } catch (err) {
      detail = `error: ${err?.message?.slice(0, 120)}`
    }
    const row = perAgent.get(c.agent) || { agent: c.agent, total: 0, passed: 0, score: 0, failures: [], sources: {}, avgLatencyMs: 0 }
    row.total += 1
    row.score += score
    row.avgLatencyMs += latencyMs
    row.sources[source] = (row.sources[source] || 0) + 1
    if (score >= PASS_THRESHOLD) row.passed += 1
    else row.failures.push({ case: c.name, score, detail })
    perAgent.set(c.agent, row)
  }

  const results = [...perAgent.values()].map((r) => ({
    ...r,
    score: Math.round((r.score / r.total) * 100) / 100,
    avgLatencyMs: Math.round(r.avgLatencyMs / r.total),
  }))
  const overall = results.length ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 100) / 100 : 0
  return { mode, overall, results }
}
