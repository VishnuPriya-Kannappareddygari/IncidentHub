import { expect, test } from '@playwright/test'
import { adminLogin, API, newReporter, seedPassword, unique } from '../utils/api-helpers.js'

const asset = () => ({ name: unique('srv'), assetTag: unique('TAG').toUpperCase(), type: 'SERVER', status: 'ACTIVE', criticality: 'HIGH' })

test('requires auth for assets @api', async ({ request }) => {
  expect((await request.get(`${API}/assets`)).status()).toBe(401)
})

test.describe('staff asset management', () => {
  test.skip(!seedPassword, 'SEED_ADMIN_PASSWORD not set')

  test('asset CRUD @api', async ({ request }) => {
    const { headers } = await adminLogin(request)
    const create = await request.post(`${API}/assets`, { headers, data: asset() })
    expect(create.status()).toBe(201)
    const created = await create.json()
    expect(created).toMatchObject({ type: 'SERVER', status: 'ACTIVE', criticality: 'HIGH' })

    expect((await request.get(`${API}/assets/${created.id}`, { headers })).status()).toBe(200)
    const patch = await request.patch(`${API}/assets/${created.id}`, { headers, data: { status: 'MAINTENANCE' } })
    expect(patch.status()).toBe(200)
    expect((await patch.json()).status).toBe('MAINTENANCE')

    expect((await request.get(`${API}/assets`, { headers })).status()).toBe(200)

    expect([200, 204]).toContain((await request.delete(`${API}/assets/${created.id}`, { headers })).status())
    expect((await request.get(`${API}/assets/${created.id}`, { headers })).status()).toBe(404)
  })

  test('asset validation and duplicate tag @api', async ({ request }) => {
    const { headers } = await adminLogin(request)
    expect((await request.post(`${API}/assets`, { headers, data: { name: '', type: 'BOGUS' } })).status()).toBe(400)
    const data = asset()
    const first = await request.post(`${API}/assets`, { headers, data })
    expect(first.status()).toBe(201)
    expect((await request.post(`${API}/assets`, { headers, data })).status()).toBe(409)
    await request.delete(`${API}/assets/${(await first.json()).id}`, { headers })
  })
})

test('reporter cannot create assets @api', async ({ request }) => {
  const { headers } = await newReporter(request)
  expect((await request.post(`${API}/assets`, { headers, data: asset() })).status()).toBe(403)
})
