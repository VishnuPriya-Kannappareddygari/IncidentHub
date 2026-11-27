import { expect, test } from '@playwright/test'
import { API, createIncident, newReporter, responderLogin, seedPassword } from '../utils/api-helpers.js'

test('SLA policies match the documented windows @api', async ({ request }) => {
  const { headers } = await newReporter(request)
  const res = await request.get(`${API}/sla/policies`, { headers })
  expect(res.status()).toBe(200)
  const text = JSON.stringify(await res.json())
  for (const n of ['15', '240', '30', '480', '120', '1440', '4320']) expect(text).toContain(n)
})

test('new incident carries SLA and escalation fields @smoke @api', async ({ request }) => {
  const { headers } = await newReporter(request)
  const incident = await createIncident(request, headers, { severity: 'SEV1' })
  const detail = await (await request.get(`${API}/incidents/${incident.id}`, { headers })).json()
  expect(detail.escalationLevel).toBe(0)
  expect(detail.sla).toHaveProperty('response')
  expect(detail.sla).toHaveProperty('resolution')
  expect(detail.sla).toHaveProperty('overall')
})

test('reporter cannot escalate or acknowledge @api', async ({ request }) => {
  const { headers } = await newReporter(request)
  const incident = await createIncident(request, headers)
  expect((await request.post(`${API}/incidents/${incident.id}/escalate`, { headers, data: { reason: 'please' } })).status()).toBe(403)
  expect((await request.post(`${API}/incidents/${incident.id}/acknowledge`, { headers })).status()).toBe(403)
})

test.describe('responder workflow', () => {
  test.skip(!seedPassword, 'SEED_ADMIN_PASSWORD not set')

  test('acknowledge then escalate up to level 3, then 409 @api', async ({ request }) => {
    const reporter = await newReporter(request)
    const incident = await createIncident(request, reporter.headers)
    const { headers } = await responderLogin(request)

    expect((await request.post(`${API}/incidents/${incident.id}/acknowledge`, { headers })).status()).toBe(200)

    for (let level = 1; level <= 3; level++) {
      const res = await request.post(`${API}/incidents/${incident.id}/escalate`, { headers, data: { reason: `test escalation ${level}` } })
      expect(res.status()).toBe(200)
      expect((await res.json()).escalationLevel).toBe(level)
    }
    expect((await request.post(`${API}/incidents/${incident.id}/escalate`, { headers, data: { reason: 'over max' } })).status()).toBe(409)
  })

  test('cannot escalate a closed incident; invalid transition is 409 @api', async ({ request }) => {
    const reporter = await newReporter(request)
    const incident = await createIncident(request, reporter.headers)
    const { headers } = await responderLogin(request)
    expect((await request.patch(`${API}/incidents/${incident.id}`, { headers, data: { status: 'RESOLVED' } })).status()).toBe(409)
    expect((await request.patch(`${API}/incidents/${incident.id}`, { headers, data: { status: 'CLOSED' } })).status()).toBe(200)
    expect((await request.post(`${API}/incidents/${incident.id}/escalate`, { headers, data: { reason: 'closed' } })).status()).toBe(409)
  })

  test('SLA status and manual check @api', async ({ request }) => {
    const { headers } = await responderLogin(request)
    expect((await request.get(`${API}/sla/status`, { headers })).status()).toBe(200)
    expect([200, 202]).toContain((await request.post(`${API}/sla/check`, { headers })).status())
  })
})
