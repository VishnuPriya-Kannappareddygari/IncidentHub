import { readInput } from './_io.mjs'

const input = await readInput()
const cmd = input?.tool_input?.command
if (typeof cmd !== 'string') process.exit(0)

const prodUrl = /DATABASE_URL\s*=\s*\S*(prod|production)/i
const rules = [
  [/prisma\s+migrate\s+reset/i, '`prisma migrate reset` is destructive. Ask the user first.'],
  [/prisma\s+(migrate\s+dev|db\s+push)/i, 'Schema writes need explicit user approval (SKILL.md rule 1).', (c) => prodUrl.test(c) || /\bNODE_ENV=production\b/.test(c)],
  [/git\s+push\b[^\n;&|]*(--force\b|--force-with-lease|\s-f\b)/i, 'Force-push is blocked. Ask the user first.'],
  [/\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)[a-z]*\s+(\/|~|\.|\*|"?C:\?"?|\.\.)(\s|$)/i, 'Refusing recursive delete of a root/repo path.'],
  [/\bnpm\s+(install|i|add)\b(?!\s+--help)/i, 'Do not install packages (SKILL.md rule 1). Tell the user what is needed and wait.'],
  [/\b(npx|pnpm\s+dlx|yarn\s+dlx)\s+(?!prisma\b|playwright\b)\S*(install|add)\b|\bnpx\s+playwright\s+install\b|\b(pip|pip3|winget|choco)\s+install\b/i, 'Installs are blocked (SKILL.md rule 1).'],
]
for (const [re, msg, extra] of rules) {
  if (re.test(cmd) && (!extra || extra(cmd))) {
    console.error(`Blocked by guard-bash: ${msg}`)
    process.exit(2)
  }
}
process.exit(0)
