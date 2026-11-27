import { env } from '../config/env.js'

// Minimal Claude Messages API client over fetch: no SDK dependency to install.
export const llmEnabled = () => env.ai.enabled && Boolean(env.ai.apiKey)

export class LlmUnavailableError extends Error {}

function extractJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('Model response contained no JSON object')
  return JSON.parse(text.slice(start, end + 1))
}

export async function callClaudeJson({ system, user, maxTokens = 1200 }) {
  if (!llmEnabled()) throw new LlmUnavailableError('Claude is not configured')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), env.ai.timeoutMs)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ai.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.ai.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })
    if (!res.ok) throw new Error(`Claude API responded ${res.status}`)
    const data = await res.json()
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
    return {
      json: extractJson(text),
      model: data.model || env.ai.model,
      tokensIn: data.usage?.input_tokens ?? 0,
      tokensOut: data.usage?.output_tokens ?? 0,
    }
  } finally {
    clearTimeout(timer)
  }
}
