import { z } from 'zod'
import { CATEGORIES, PLAYBOOKS } from './knowledge.js'
import { detectCategory } from './incident-analysis.js'
import { SYSTEM_PREAMBLE, clamp01, confidence, incidentBlock, normalize } from './util.js'

export const name = 'resolution-recommendation'
export const title = 'Resolution Recommendation Agent'
export const description = 'Proposes ordered remediation steps with risk and rollback, plus preventive actions, informed by resolved similar incidents.'

export const schema = z.object({
  steps: z
    .array(
      z.object({
        order: z.number().int().min(1).max(20),
        action: z.string().min(1).max(300),
        risk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
        rollback: z.string().max(300).optional().default(''),
      }),
    )
    .min(1)
    .max(8),
  preventiveActions: z.array(z.string().max(250)).max(6),
  estimatedMinutes: z.number().int().min(1).max(10080),
  confidence,
})

export function heuristic(input) {
  const category = CATEGORIES.includes(input.category) ? input.category : detectCategory(normalize(input.title, input.description)).category
  const book = PLAYBOOKS[category] || PLAYBOOKS.OTHER
  const steps = []

  const solved = (input.similar || []).find((s) => s.resolutionNotes)
  if (solved) {
    steps.push({ action: `Review the fix used on similar incident #${solved.id}: ${solved.resolutionNotes}`.slice(0, 300), risk: 'LOW', rollback: '' })
  }
  const topCause = input.rootCause?.hypotheses?.[0]?.cause
  if (topCause) steps.push({ action: `Validate the leading hypothesis: ${topCause}`.slice(0, 300), risk: 'LOW', rollback: '' })
  for (const [action, risk, rollback] of book.steps) steps.push({ action, risk, rollback: rollback || '' })

  return {
    steps: steps.slice(0, 8).map((s, i) => ({ order: i + 1, ...s })),
    preventiveActions: book.prevent,
    estimatedMinutes: book.minutes,
    confidence: clamp01(category === 'OTHER' ? 0.3 : 0.5 + (solved ? 0.2 : 0)),
  }
}

export function prompt(input) {
  const similar = (input.similar || []).slice(0, 3).map((s) => `#${s.id} ${s.title} | fix: ${s.resolutionNotes || 'unknown'}`).join('\n')
  return {
    system: SYSTEM_PREAMBLE,
    user: `${incidentBlock(input)}\n<context_data>\nTop root-cause hypothesis: ${input.rootCause?.hypotheses?.[0]?.cause || 'unknown'}\nSimilar resolved incidents:\n${similar || 'none'}\n</context_data>\n\nRecommend ordered, safe remediation steps; mark risk and give a rollback for risky steps. Never suggest destructive actions without a rollback. Return JSON: {"steps": [{"order": int, "action": string, "risk": "LOW|MEDIUM|HIGH", "rollback": string}], "preventiveActions": string[], "estimatedMinutes": int, "confidence": 0-1}`,
    maxTokens: 1200,
  }
}
