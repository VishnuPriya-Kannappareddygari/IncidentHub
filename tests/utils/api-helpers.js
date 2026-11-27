import { expect } from '@playwright/test'

export const API = '/api/v1'

// Registers a fresh REPORTER so each test owns its data.
export async function newReporter(request) {
  const email = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
  const res = await request.post(`${API}/auth/register`, { data: { name: 'Test User', email, password: 'password123' } })
  expect(res.status()).toBe(201)
  const { token, user } = await res.json()
  return { user, headers: { Authorization: `Bearer ${token}` } }
}

// Seeded staff login. Needs SEED_ADMIN_PASSWORD (same value as server/.env) in the test env.
export const seedPassword = process.env.SEED_ADMIN_PASSWORD

export async function login(request, email) {
  const res = await request.post(`${API}/auth/login`, { data: { email, password: seedPassword } })
  expect(res.status()).toBe(200)
  const { token, user } = await res.json()
  return { user, headers: { Authorization: `Bearer ${token}` } }
}

export const adminLogin = (request) => login(request, 'admin@incidenthub.test')
export const responderLogin = (request) => login(request, 'responder@incidenthub.test')

export async function createIncident(request, headers, overrides = {}) {
  const res = await request.post(`${API}/incidents`, {
    headers,
    data: { title: 'Checkout API returning 500 errors', severity: 'SEV2', description: 'Error rate above 20% on checkout service', ...overrides },
  })
  expect(res.status()).toBe(201)
  return res.json()
}

export const unique = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
