import { z } from 'zod'
import { SYSTEM_PREAMBLE } from './util.js'

export const name = 'sla-monitoring'
export const title = 'SLA Monitoring Agent'
export const description = 'Reviews open incidents against SLA targets, flags breaches and risks, and recommends escalations.'

const STATES = ['MET', 'ON_TRACK', 'AT_RISK', 'BREACHED']

export const schema = z.object({
  overall: z.object({ breached: z.number().int().min(0), atRisk: z.number().int().min(0), healthy: z.number().int().min(0) }),
  items: z
    .array(z.object({ incidentId: z.number().int(), state: z.enum(STATES), minutesRemaining: z.number(), recommendation: z.string().max(300) }))
    .max(50),
  escalationRecommendations: z.array(z.string().max(300)).max(10),
  narrative: z.string().max(800),
})

const humanMinutes = (m) => {
  const abs = Math.abs(Math.round(m))
  return abs >= 120 ? `${Math.round(abs / 60)}h` : `${abs}m`
}

// input.incidents: [{ id, title, severity, status, assignee, escalationLevel, sla: { overall, resolution: { minutesRemaining } } }]
export function heuristic(input) {
  const items = (input.incidents || []).slice(0, 50).map((i) => {
    const state = i.sla?.overall || 'ON_TRACK'
    const minutes = i.sla?.resolution?.minutesRemaining ?? 0
    let recommendation = 'No action needed.'
    if (state === 'BREACHED') recommendation = `Overdue by ${humanMinutes(minutes)}. ${i.escalationLevel >= 3 ? 'Already at maximum escalation: request an executive status update.' : 'Escalate to the next level now.'}`
    else if (state === 'AT_RISK') recommendation = `${humanMinutes(minutes)} left. ${i.assignee ? 'Ask the assignee for an ETA.' : 'Assign an owner immediately.'}`
    return { incidentId: i.id, state, minutesRemaining: Math.round(minutes), recommendation }
  })
  const breached = items.filter((i) => i.state === 'BREACHED')
  const atRisk = items.filter((i) => i.state === 'AT_RISK')
  const escalationRecommendations = [
    ...breached.filter((b) => (input.incidents.find((i) => i.id === b.incidentId)?.escalationLevel ?? 0) < 3).map((b) => `Escalate #${b.incidentId}: SLA breached`),
    ...atRisk.filter((a) => !input.incidents.find((i) => i.id === a.incidentId)?.assignee).map((a) => `Assign an owner to #${a.incidentId} before its SLA breaches`),
  ].slice(0, 10)
  const healthy = items.length - breached.length - atRisk.length
  return {
    overall: { breached: breached.length, atRisk: atRisk.length, healthy },
    items,
    escalationRecommendations,
    narrative: items.length === 0 ? 'No active incidents to monitor.' : `${breached.length} breached, ${atRisk.length} at risk and ${healthy} on track out of ${items.length} active incidents.`,
  }
}

export function prompt(input) {
  const rows = (input.incidents || []).slice(0, 30).map((i) => `#${i.id} ${i.severity} ${i.status} esc=${i.escalationLevel} sla=${i.sla?.overall} remaining=${Math.round(i.sla?.resolution?.minutesRemaining ?? 0)}m assignee=${i.assignee || 'none'}`).join('\n')
  return {
    system: SYSTEM_PREAMBLE,
    user: `<context_data>\n${rows || 'no incidents'}\n</context_data>\n\nReview SLA health. Return JSON: {"overall": {"breached": int, "atRisk": int, "healthy": int}, "items": [{"incidentId": int, "state": "MET|ON_TRACK|AT_RISK|BREACHED", "minutesRemaining": number, "recommendation": string}], "escalationRecommendations": string[], "narrative": string}. Only mention incidents listed.`,
    maxTokens: 1400,
  }
}
