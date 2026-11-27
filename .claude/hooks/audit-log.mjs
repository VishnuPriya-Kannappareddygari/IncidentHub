import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readInput } from './_io.mjs'

const input = await readInput()
if (!input) process.exit(0)
try {
  const ti = input.tool_input || {}
  // Metadata only: never file contents, commands' env values, or tool output.
  const entry = {
    ts: new Date().toISOString(),
    session: input.session_id,
    tool: input.tool_name,
    target: ti.file_path || ti.path || ti.pattern || (typeof ti.command === 'string' ? ti.command.replace(/(\w*(KEY|SECRET|TOKEN|PASSWORD|URL)\w*=)\S+/gi, '$1[redacted]').slice(0, 200) : undefined),
  }
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'logs')
  mkdirSync(dir, { recursive: true })
  appendFileSync(join(dir, 'tool-audit.jsonl'), JSON.stringify(entry) + '\n')
} catch {
  // Logging must never break work.
}
process.exit(0)
