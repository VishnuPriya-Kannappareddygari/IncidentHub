import { expect, test } from '@playwright/test'

// Each test registers its own user, so tests are independent and order-free.
async function newUser(request) {
  const email = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
  const res = await request.post('/api/v1/auth/register', { data: { name: 'Test User', email, password: 'password123' } })
  expect(res.status()).toBe(201)
  const { token, user } = await res.json()
  return { user, headers: { Authorization: `Bearer ${token}` } }
}

test('health endpoint @smoke @api', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
})

test('rejects unauthenticated access @api', async ({ request }) => {
  expect((await request.get('/api/v1/incidents')).status()).toBe(401)
})

test('register validates input and rejects duplicates @api', async ({ request }) => {
  expect((await request.post('/api/v1/auth/register', { data: { name: 'x', email: 'bad', password: '1' } })).status()).toBe(400)
  const { user } = await newUser(request)
  const dup = await request.post('/api/v1/auth/register', { data: { name: 'Dup', email: user.email, password: 'password123' } })
  expect(dup.status()).toBe(409)
})

test('creates and fetches an incident @smoke @api', async ({ request }) => {
  const { headers } = await newUser(request)
  const res = await request.post('/api/v1/incidents', {
    headers,
    data: { title: 'DB latency spike', severity: 'SEV2', description: 'p95 > 2s' },
  })
  expect(res.status()).toBe(201)
  const created = await res.json()
  expect(created).toMatchObject({ title: 'DB latency spike', status: 'OPEN', severity: 'SEV2' })

  const detail = await (await request.get(`/api/v1/incidents/${created.id}`, { headers })).json()
  expect(detail.events[0].type).toBe('CREATED')
})

test('validation and unknown fields are rejected @api', async ({ request }) => {
  const { headers } = await newUser(request)
  expect((await request.post('/api/v1/incidents', { headers, data: { title: 'ab', severity: 'SEV9', description: '' } })).status()).toBe(400)
  expect((await request.post('/api/v1/incidents', { headers, data: { title: 'Valid title', severity: 'SEV3', description: 'd', role: 'ADMIN' } })).status()).toBe(400)
})

test('reporter cannot change triage fields or list users @api', async ({ request }) => {
  const { headers } = await newUser(request)
  const created = await (await request.post('/api/v1/incidents', { headers, data: { title: 'Mine', severity: 'SEV3', description: 'd' } })).json()
  expect((await request.patch(`/api/v1/incidents/${created.id}`, { headers, data: { status: 'INVESTIGATING' } })).status()).toBe(403)
  expect((await request.get('/api/v1/users', { headers })).status()).toBe(403)
})

test('comments, 404s and filters @api', async ({ request }) => {
  const { headers } = await newUser(request)
  const created = await (await request.post('/api/v1/incidents', { headers, data: { title: 'Filterable one', severity: 'SEV1', description: 'd' } })).json()
  expect((await request.post(`/api/v1/incidents/${created.id}/comments`, { headers, data: { body: 'Looking' } })).status()).toBe(201)
  expect((await request.get('/api/v1/incidents/99999999', { headers })).status()).toBe(404)

  const list = await (await request.get('/api/v1/incidents?severity=SEV1&q=Filterable&pageSize=5', { headers })).json()
  expect(list.items.some((i) => i.id === created.id)).toBe(true)
  expect(list).toMatchObject({ page: 1, pageSize: 5 })
})
