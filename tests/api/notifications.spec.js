import { expect, test } from '@playwright/test'
import { API, newReporter } from '../utils/api-helpers.js'

const itemsOf = (body) => (Array.isArray(body) ? body : body.items)

test('notifications require auth @api', async ({ request }) => {
  expect((await request.get(`${API}/notifications`)).status()).toBe(401)
})

test('lists and marks notifications read @smoke @api', async ({ request }) => {
  const { headers } = await newReporter(request)
  const res = await request.get(`${API}/notifications`, { headers })
  expect(res.status()).toBe(200)
  expect(Array.isArray(itemsOf(await res.json()))).toBe(true)
  expect([200, 204]).toContain((await request.post(`${API}/notifications/read-all`, { headers })).status())
})

test('marking an unknown notification read is 404 @api', async ({ request }) => {
  const { headers } = await newReporter(request)
  expect((await request.patch(`${API}/notifications/does-not-exist/read`, { headers })).status()).toBe(404)
})

test('users only see their own notifications @api', async ({ request }) => {
  const a = await newReporter(request)
  const b = await newReporter(request)
  const itemsA = itemsOf(await (await request.get(`${API}/notifications`, { headers: a.headers })).json())
  const idsB = new Set(itemsOf(await (await request.get(`${API}/notifications`, { headers: b.headers })).json()).map((n) => n.id))
  expect(itemsA.every((n) => !idsB.has(n.id))).toBe(true)
})
