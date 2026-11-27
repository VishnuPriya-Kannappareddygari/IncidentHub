import { readInput } from './_io.mjs'

const input = await readInput()
const p = input?.tool_input?.file_path
if (typeof p !== 'string') process.exit(0)
const name = p.split(String.fromCharCode(92)).join('/').split('/').pop()
const isEnv = /^\.env(\..+)?$/.test(name) && !/\.example$/.test(name)
if (isEnv) {
  console.error(`Blocked by protect-secrets: ${name} may hold real secrets. Only .env.example may be read or edited; ask the user to edit real env files.`)
  process.exit(2)
}
process.exit(0)
