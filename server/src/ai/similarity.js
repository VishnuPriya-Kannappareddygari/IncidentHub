import { prisma } from '../lib/prisma.js'

const STOP = new Set('the a an and or of to in on for with is are was were be been it this that at by from as not no we our after before has have had since still'.split(' '))

export const tokenize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t))

const termFreq = (tokens) => {
  const tf = new Map()
  tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1))
  return tf
}

// TF-IDF cosine similarity over a candidate corpus: no external dependency or embedding service required.
export function rankSimilar(query, candidates, limit = 5, minScore = 0.12) {
  const docs = candidates.map((c) => ({ c, tf: termFreq(tokenize(`${c.title} ${c.title} ${c.description}`)) }))
  const q = termFreq(tokenize(`${query.title} ${query.title} ${query.description}`))
  const n = docs.length + 1
  const df = new Map()
  for (const { tf } of docs) for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1)
  for (const t of q.keys()) df.set(t, (df.get(t) || 0) + 1)

  const weigh = (tf) => {
    const v = new Map()
    for (const [t, f] of tf) v.set(t, (1 + Math.log(f)) * Math.log(1 + n / df.get(t)))
    return v
  }
  const norm = (v) => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0))
  const qv = weigh(q)
  const qn = norm(qv)
  if (qn === 0) return []

  return docs
    .map(({ c, tf }) => {
      const dv = weigh(tf)
      let dot = 0
      for (const [t, w] of qv) if (dv.has(t)) dot += w * dv.get(t)
      const denom = qn * norm(dv)
      return { ...c, score: denom ? Math.round((dot / denom) * 100) / 100 : 0 }
    })
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

const pick = { id: true, title: true, description: true, status: true, severity: true, category: true, rootCause: true, resolutionNotes: true }

// Finds past incidents resembling the given text. excludeId keeps an incident from matching itself.
export async function findSimilar({ title, description }, { excludeId, limit = 5 } = {}) {
  const candidates = await prisma.incident.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    select: pick,
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  return rankSimilar({ title, description }, candidates, limit).map(({ description: _d, ...rest }) => rest)
}
