import { expect, test } from '@playwright/test'
import { adminLogin, API, createIncident, newReporter, seedPassword } from '../utils/api-helpers.js'

test('reports require auth @api', async ({ request }) => {
  expect((await request.get(`${API}/reports/summary`)).status()).toBe(401)
})

test('reporter cannot export @api', async ({ request }) => {
  const { headers } = await newReporter(request)
  expect((await request.get(`${API}/reports/incidents.csv`, { headers })).status()).toBe(403)
})

test.describe('staff reports', () => {
  test.skip(!seedPassword, 'SEED_ADMIN_PASSWORD not set')

  test('summary, CSV and JSON exports @api', async ({ request }) => {
    const reporter = await newReporter(request)
    const incident = await createIncident(request, reporter.headers, { title: 'Report export probe incident' })
    const { headers } = await adminLogin(request)

    const summary = await request.get(`${API}/reports/summary`, { headers })
    expect(summary.status()).toBe(200)
    expect(typeof (await summary.json())).toBe('object')

    const csv = await request.get(`${API}/reports/incidents.csv`, { headers })
    expect(csv.status()).toBe(200)
    expect(csv.headers()['content-type']).toContain('text/csv')
    const text = await csv.text()
    expect(text.split('\n')[0].toLowerCase()).toContain('title')
    expect(text).toContain('Report export probe incident')

    const sla = await request.get(`${API}/reports/sla.csv`, { headers })
    expect(sla.status()).toBe(200)
    expect(sla.headers()['content-type']).toContain('text/csv')

    const json = await request.get(`${API}/reports/incidents.json`, { headers })
    expect(json.status()).toBe(200)
    const body = await json.json()
    const items = Array.isArray(body) ? body : body.items
    expect(items.some((i) => i.id === incident.id)).toBe(true)
  })
})
