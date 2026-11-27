import { z } from 'zod'
import { CATEGORIES, RCA_LIBRARY } from './knowledge.js'
import { detectCategory } from './incident-analysis.js'
import { SYSTEM_PREAMBLE, clamp01, confidence, incidentBlock, normalize } from './util.js'

export const name = 'root-cause-analysis'
export const title = 'Root Cause Analysis Agent'
export const description = 'Ranks likely root causes with evidence and verification steps, using the category playbook and similar past incidents.'

export const schema = z.object({
  hypotheses: z
    .array(
      z.object({
        cause: z.string().min(1).max(300),
        likelihood: confidence,
        evidence: z.string().max(400),
        verificationSteps: z.array(z.string().max(250)).max(6),
      }),
    )
    .min(1)
    .max(5),
  confidence,
})

export function heuristic(input) {
  const category = CATEGORIES.includes(input.category) ? input.category : detectCategory(normalize(input.title, input.description)).category
  const library = RCA_LIBRARY[category] || RCA_LIBRARY.OTHER
  const weights = library.map((_, i) => 1 / (i + 1))
  const total = weights.reduce((a, b) => a + b, 0)

  const hypotheses = library.map((h, i) => ({ ...h, likelihood: clamp01(weights[i] / total) }))

  // Past root causes of similar incidents are the strongest evidence we have.
  const known = (input.similar || []).filter((s) => s.rootCause).slice(0, 2)
  known.forEach((s) =>
    hypotheses.unshift({
      cause: s.rootCause.slice(0, 300),
      likelihood: clamp01(0.3 + (s.score || 0) * 0.5),
      evidence: `Root cause recorded on similar incident #${s.id} (similarity ${Math.round((s.score || 0) * 100)}%)`,
      verificationSteps: ['Check whether the same trigger or recent change applies here'],
    }),
  )

  const top = hypotheses.sort((a, b) => b.likelihood - a.likelihood).slice(0, 4)
  return { hypotheses: top, confidence: clamp01(category === 'OTHER' ? 0.25 : 0.45 + (known.length ? 0.2 : 0)) }
}

export function prompt(input) {
  const similar = (input.similar || []).slice(0, 3).map((s) => `#${s.id} ${s.title} | root cause: ${s.rootCause || 'unknown'}`).join('\n')
  return {
    system: SYSTEM_PREAMBLE,
    user: `${incidentBlock(input)}\n<context_data>\nAnalysis summary: ${input.analysis?.summary || 'n/a'}\nSimilar incidents:\n${similar || 'none'}\n</context_data>\n\nRank up to 4 root-cause hypotheses, most likely first. Do not claim certainty without evidence. Return JSON: {"hypotheses": [{"cause": string, "likelihood": 0-1, "evidence": string, "verificationSteps": string[]}], "confidence": 0-1}`,
    maxTokens: 1000,
  }
}
