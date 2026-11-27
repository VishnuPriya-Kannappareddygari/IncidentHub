import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'

// Governance controls applied to every agent run. Agents only recommend; applying a recommendation
// is a normal, role-checked, audited incident update performed by a human.
export const POLICIES = [
  { id: 'human-in-the-loop', title: 'Human in the loop', description: 'Agents never modify incidents. Staff apply suggestions through the normal PATCH endpoint, and acceptance is recorded as feedback.' },
  { id: 'pii-redaction', title: 'PII and secret redaction', description: 'Emails, phone numbers, card numbers, bearer tokens, API keys and password assignments are masked before text reaches the model, and again on model output.' },
  { id: 'prompt-injection-defence', title: 'Prompt injection defence', description: 'Incident text is wrapped as untrusted data, injection phrases are flagged, and outputs must pass strict schema validation.' },
  { id: 'role-gating', title: 'Role-based access', description: 'Only responders and admins can run analysis agents on existing incidents; reporters may only use triage preview.' },
  { id: 'budget', title: 'Daily call budget', description: 'Claude calls are capped per day (AI_DAILY_CALL_LIMIT); beyond that agents use heuristics.' },
  { id: 'output-validation', title: 'Output validation and clamping', description: 'Enums, confidence values and text lengths are validated; invalid model output falls back to the heuristic result.' },
  { id: 'audit-trail', title: 'Full audit trail', description: 'Every run is stored in agent_runs with trace id, source, latency, tokens, flags and a redacted input preview.' },
]

const PATTERNS = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL]'],
  [/\b(?:\d[ -]*?){13,16}\b/g, '[CARD]'],
  [/\b(?:\+?\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g, '[PHONE]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{10,}/gi, 'Bearer [TOKEN]'],
  [/\b(?:sk|pk|ghp|xox[abp])[-_][A-Za-z0-9_-]{12,}/g, '[API_KEY]'],
  [/\b(password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[REDACTED]'],
]

export function redact(text) {
  return PATTERNS.reduce((out, [re, sub]) => out.replace(re, sub), String(text ?? ''))
}

const INJECTION = [
  /ignore (all |any )?(previous|prior|above) (instructions|prompts)/i,
  /disregard (the )?(system|previous) (prompt|instructions)/i,
  /you are now\b/i,
  /reveal (your )?(system )?prompt/i,
  /\bact as\b.{0,30}\b(admin|root|developer)\b/i,
]

const MAX_FIELD = 4000

// Returns cleaned input fields plus governance flags. Never throws: bad input is cleaned, not rejected.
export function guardInput(fields) {
  const flags = []
  const clean = {}
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'string') {
      clean[key] = value
      continue
    }
    let text = value
    if (text.length > MAX_FIELD) {
      text = text.slice(0, MAX_FIELD)
      flags.push('input-truncated')
    }
    if (INJECTION.some((re) => re.test(text))) flags.push('prompt-injection-suspected')
    const redacted = redact(text)
    if (redacted !== text) flags.push('pii-redacted')
    clean[key] = redacted
  }
  return { clean, flags: [...new Set(flags)] }
}

// Applies redaction to every string in an agent output (defence against echoing secrets).
export function sanitizeOutput(value) {
  if (typeof value === 'string') return redact(value).slice(0, 2000)
  if (Array.isArray(value)) return value.map(sanitizeOutput)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizeOutput(v)]))
  return value
}

const STAFF = ['ADMIN', 'RESPONDER']
export const canRunAgent = (user, agent) => (agent.publicAccess ? Boolean(user) : STAFF.includes(user?.role))

const startOfDay = () => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export const usedToday = () => prisma.agentRun.count({ where: { source: 'claude', createdAt: { gte: startOfDay() } } })

export async function withinBudget() {
  return (await usedToday()) < env.ai.dailyCallLimit
}
