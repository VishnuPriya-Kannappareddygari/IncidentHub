// Offline agent evaluation: `npm run eval` (heuristic) or `npm run eval:live` (uses Claude if configured).
// Does not touch the database; exits non-zero when quality drops below the gate.
import { runEvals } from '../src/ai/evals/runner.js'

const mode = process.argv.includes('--live') ? 'live' : 'heuristic'
const GATE = Number(process.env.EVAL_MIN_SCORE || 0.8)

const report = await runEvals({ mode })
for (const r of report.results) {
  console.log(`${r.agent.padEnd(28)} ${String(r.passed).padStart(2)}/${String(r.total).padEnd(2)} score ${r.score.toFixed(2)}  avg ${r.avgLatencyMs}ms`)
  for (const f of r.failures) console.log(`    FAIL ${f.case} (score ${f.score}) ${f.detail}`)
}
console.log(`overall ${report.overall.toFixed(2)} (gate ${GATE}, mode ${mode})`)
process.exit(report.overall >= GATE ? 0 : 1)
