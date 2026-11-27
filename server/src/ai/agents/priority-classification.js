import { z } from 'zod'
import { SEVERITY_SIGNALS } from './knowledge.js'
import { SYSTEM_PREAMBLE, clamp01, confidence, countHits, incidentBlock, normalize } from './util.js'

export const name = 'priority-classification'
export const title = 'Priority Classification Agent'
export const description = 'Recommends severity (SEV1-SEV4) and urgency from impact signals, affected asset criticality and scale.'
export const publicAccess = true

const SEVERITIES = ['SEV1', 'SEV2', 'SEV3', 'SEV4']
const URGENCY = { SEV1: 'CRITICAL', SEV2: 'HIGH', SEV3: 'MEDIUM', SEV4: 'LOW' }

export const schema = z.object({
  severity: z.enum(SEVERITIES),
  urgency: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  rationale: z.string().min(1).max(500),
  factors: z.array(z.string().max(200)).max(8),
  confidence,
})

export function heuristic(input) {
  const text = normalize(input.title, input.description)
  const factors = []
  let index = 2 // default SEV3

  const hits = SEVERITIES.map((s) => countHits(text, SEVERITY_SIGNALS[s]))
  const first = hits.findIndex((n) => n > 0)
  if (first !== -1) {
    index = first
    factors.push(`Matched ${SEVERITIES[first]} signals in the report (${hits[first]})`)
  } else {
    factors.push('No strong severity keywords; defaulting to SEV3')
  }

  const users = String(input.description).match(/(\d[\d,]*)\s*(users|customers|employees|people)/i)
  const count = users ? Number(users[1].replace(/,/g, '')) : 0
  if (count >= 100 && index > 0) {
    index -= 1
    factors.push(`Large user impact (${count})`)
  }
  if (input.assetCriticality === 'CRITICAL' && index > 0 && index < 3) {
    index -= 1
    factors.push('Affected asset is business critical')
  }
  if (input.assetCriticality === 'LOW' && index < 3 && index > 1) {
    index += 1
    factors.push('Affected asset has low criticality')
  }
  const severity = SEVERITIES[index]
  return {
    severity,
    urgency: URGENCY[severity],
    rationale: `${severity} recommended: ${factors.join('; ')}.`.slice(0, 500),
    factors,
    confidence: clamp01(first === -1 ? 0.4 : 0.55 + Math.min(hits[first], 3) * 0.1),
  }
}

export function prompt(input) {
  return {
    system: SYSTEM_PREAMBLE,
    user: `${incidentBlock(input)}\n\nSeverity guide: SEV1 outage or data loss for many users; SEV2 major function degraded; SEV3 minor/workaround exists; SEV4 cosmetic or request. Return JSON: {"severity": "SEV1|SEV2|SEV3|SEV4", "urgency": "CRITICAL|HIGH|MEDIUM|LOW", "rationale": string, "factors": string[], "confidence": number 0-1}`,
    maxTokens: 500,
  }
}
