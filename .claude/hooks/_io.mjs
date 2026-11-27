// Shared helper: read hook JSON from stdin. Returns null on any failure so hooks fail OPEN.
export async function readInput() {
  try {
    const chunks = []
    for await (const c of process.stdin) chunks.push(c)
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }
}
