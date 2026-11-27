import { expect, test } from '@playwright/test'

// Requires the seeded users (db:seed) in the TEST database. Always run headed.
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe-Admin1'

async function login(page, email, password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  // Wait until the session is stored; navigating earlier would reload the page without a token.
  if (password === PASSWORD) await expect(page.getByTestId('current-user')).toBeVisible()
}

const uniqueTitle = (prefix) => `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

test('redirects anonymous users to login @smoke @e2e', async ({ page }) => {
  await page.goto('/incidents')
  await expect(page).toHaveURL(/\/login/)
})

test('rejects a bad password @e2e', async ({ page }) => {
  await login(page, 'admin@incidenthub.test', 'wrong-password')
  await expect(page.getByRole('alert')).toContainText('Invalid email or password')
})

test('admin sees dashboard and users page @smoke @e2e', async ({ page }) => {
  await login(page, 'admin@incidenthub.test')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByTestId('stat-total')).toBeVisible()
  await page.getByRole('link', { name: 'Users' }).click()
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
})

test('reporter cannot see Users nav or triage controls @e2e', async ({ page }) => {
  await login(page, 'reporter@incidenthub.test')
  await expect(page.getByTestId('current-user')).toContainText('REPORTER')
  await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0)
  await page.goto('/users')
  await expect(page.getByText('You do not have access to this page.')).toBeVisible()
})

test('reporter creates an incident, responder triages and comments @smoke @e2e', async ({ page }) => {
  const title = uniqueTitle('E2E outage')

  await login(page, 'reporter@incidenthub.test')
  await page.getByRole('link', { name: 'Report', exact: true }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Description').fill('Created by Playwright')
  await page.getByLabel('Severity').selectOption('SEV2')
  await page.getByRole('button', { name: 'Submit incident' }).click()
  await expect(page.getByRole('heading', { name: new RegExp(title) })).toBeVisible()
  await expect(page.getByLabel('Status')).toHaveCount(0) // no triage controls for reporters
  await page.getByRole('button', { name: 'Log out' }).click()

  await login(page, 'responder@incidenthub.test')
  await page.goto('/incidents')
  await page.getByLabel('Search').fill(title)
  await page.getByRole('link', { name: title }).click()

  await page.getByLabel('Status').selectOption('INVESTIGATING')
  await expect(page.getByLabel('Activity timeline')).toContainText('OPEN → INVESTIGATING')

  await page.getByLabel('Add a comment').fill('Looking into it')
  await page.getByRole('button', { name: 'Post comment' }).click()
  await expect(page.getByLabel('Comments')).toContainText('Looking into it')

  await page.getByLabel('Status').selectOption('RESOLVED')
  await expect(page.getByLabel('Activity timeline')).toContainText('INVESTIGATING → RESOLVED')
})

test('invalid status move shows an error @e2e', async ({ page }) => {
  const title = uniqueTitle('E2E lifecycle')
  await login(page, 'responder@incidenthub.test')
  await page.getByRole('link', { name: 'Report', exact: true }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Description').fill('lifecycle check')
  await page.getByRole('button', { name: 'Submit incident' }).click()
  await page.getByLabel('Status').selectOption('RESOLVED') // OPEN -> RESOLVED is not allowed
  await expect(page.getByRole('alert')).toContainText('Cannot move an incident from OPEN to RESOLVED')
})

test('filters narrow the incident list @e2e', async ({ page }) => {
  await login(page, 'responder@incidenthub.test')
  await page.goto('/incidents')
  await page.getByLabel('Severity', { exact: true }).selectOption('SEV1')
  await expect(page).toHaveURL(/severity=SEV1/)
  const rows = page.getByTestId('incident-table').locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  for (const badge of await rows.locator('.sev-SEV1').all()) await expect(badge).toBeVisible()
  expect(await rows.count()).toBe(await rows.locator('.sev-SEV1').count())
})
