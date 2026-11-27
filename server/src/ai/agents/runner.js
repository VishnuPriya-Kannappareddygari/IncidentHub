import crypto from 'node:crypto'
import { callClaudeJson, llmEnabled } from '../llm.js'
import { canRunAgent, guardInput, sanitizeOutput, withinBudget } from '../governance.js'
import { recordRun } from '../observability.js'
import { forbidden } from '../../lib/errors.js'

const TEXT_FIELDS = ['title', 'description', 'assetName']

// Cleans the free-text parts of an agent input (redaction, truncation, injection flags).
function governInput(input) {
  const { clean, flags } = guardInput(Object.fromEntries(TEXT_FIELDS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]])))
  return { input: { ...input, ...clean }, flags }
}

// Runs one agent under governance and observability:
// role check -> redact -> (budget) Claude -> schema validate -> sanitize -> fallback to heuristic on any failure.
export async function execute(agent, rawInput, { user, incidentId = null, traceId = crypto.randomUUID(), persist = true, forceHeuristic = false } = {}) {
  // A null/undefined user means a system-initiated run (auto-analysis, evals); HTTP routes always pass the caller.
  if (user && !canRunAgent(user, agent)) throw forbidden('Your role cannot run this agent')

  const started = Date.now()
  const { input, flags } = governInput(rawInput)
  let source = 'heuristic'
  let model = null
  let tokensIn = 0
  let tokensOut = 0
  let error = null
  let output

  const useClaude = !forceHeuristic && llmEnabled() && (!persist || (await withinBudget()))
  if (!forceHeuristic && llmEnabled() && persist && !useClaude) flags.push('budget-exceeded')

  if (useClaude) {
    try {
      const { system, user: prompt, maxTokens } = agent.prompt(input)
      const res = await callClaudeJson({ system, user: prompt, maxTokens })
      output = agent.schema.parse(res.json)
      source = 'claude'
      model = res.model
      tokensIn = res.tokensIn
      tokensOut = res.tokensOut
    } catch (err) {
      source = 'heuristic-fallback'
      error = err?.message?.slice(0, 300) || 'unknown error'
      flags.push('llm-fallback')
    }
  }

  if (!output) output = agent.schema.parse(agent.heuristic(input))
  output = sanitizeOutput(output)

  const result = { agent: agent.name, traceId, source, model, latencyMs: Date.now() - started, flags: [...new Set(flags)], output, runId: null }
  if (persist) result.runId = await recordRun({ ...result, incidentId, actorId: user?.id ?? null, tokensIn, tokensOut, error, input })
  return result
}
