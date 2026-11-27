import { z } from 'zod'
import { CATEGORIES, CATEGORY_KEYWORDS } from './knowledge.js'
import { SYSTEM_PREAMBLE, clamp01, confidence, countHits, incidentBlock, normalize } from './util.js'

export const name = 'incident-analysis'
export const title = 'Incident Analysis Agent'
export const description = 'Summarises the incident, classifies its category, and extracts affected systems and impact.'
export const publicAccess = true

export const schema = z.object({
  summary: z.string().min(1).max(600),
  keyPoints: z.array(z.string().max(300)).max(6),
  category: z.enum(CATEGORIES),
  affectedSystems: z.array(z.string().max(80)).max(8),
  impact: z.string().max(300),
  confidence,
})

export function detectCategory(text) {
  let best = 'OTHER'
  let bestScore = 0
  for (const category of Object.keys(CATEGORY_KEYWORDS)) {
    const score = countHits(text, CATEGORY_KEYWORDS[category])
    if (score > bestScore) {
      best = category
      bestScore = score
    }
  }
  return { category: best, score: bestScore }
}

export function heuristic(input) {
  const text = normalize(input.title, input.description)
  const { category, score } = detectCategory(text)
  const sentences = String(input.description).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  const users = String(input.description).match(/(\d[\d,]*)\s*(users|customers|employees|people|requests)/i)

  const affected = new Set()
  if (input.assetName) affected.add(input.assetName)
  for (const k of CATEGORY_KEYWORDS[category] || []) if (text.includes(` ${k} `) || (k.length > 4 && text.includes(k))) affected.add(k)

  return {
    summary: `${input.title}. ${sentences[0] || ''}`.trim().slice(0, 600),
    keyPoints: sentences.slice(0, 4).map((s) => s.slice(0, 300)),
    category,
    affectedSystems: [...affected].slice(0, 6),
    impact: users ? `Approximately ${users[1]} ${users[2].toLowerCase()} affected` : `Impact not quantified; classified as ${category.toLowerCase()} issue`,
    confidence: clamp01(0.35 + score * 0.15),
  }
}

export function prompt(input) {
  return {
    system: SYSTEM_PREAMBLE,
    user: `${incidentBlock(input)}\n\nSummarise this incident for responders. Return JSON: {"summary": string (<=400 chars), "keyPoints": string[] (<=5), "category": one of ${CATEGORIES.join('|')}, "affectedSystems": string[], "impact": string, "confidence": number 0-1}`,
    maxTokens: 700,
  }
}
