import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readInput } from './_io.mjs'

const input = await readInput()
const p = input?.tool_input?.file_path
if (typeof p !== 'string') process.exit(0)
const norm = p.split(String.fromCharCode(92)).join('/')
if (!/\/server\/.*\.(js|mjs)$/.test(norm) || /\/node_modules\//.test(norm) || !existsSync(p)) process.exit(0)

const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' })
if (r.status !== 0) {
  console.error(`Syntax check failed for ${p}:\n${r.stderr}`)
  process.exit(2)
}
process.exit(0)
