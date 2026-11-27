import { defineConfig } from '@playwright/test'

const isCI = !!process.env.CI
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
const API_URL = process.env.API_URL || 'http://localhost:4000'

export default defineConfig({
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]] : 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'api', testDir: './api', use: { baseURL: API_URL } },
    // Pass --headed when you want to watch e2e runs.
    { name: 'e2e', testDir: './e2e', use: { baseURL: BASE_URL } },
  ],
})
