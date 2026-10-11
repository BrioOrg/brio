import { defineConfig, devices } from '@playwright/test'

// Fixed ports, away from a local `pnpm dev` (3000) and the real backend (8080).
const BACKEND_PORT = 8099
const WEB_PORT = 3100

/**
 * E2E tests run against a fake backend that reads `content/` (e2e/fake-backend.mjs, #259):
 * no Docker, no Java. `next dev` is required, not `next start`: the `/api` rewrite that
 * sends the browser's calls to the backend only exists in development (next.config.ts).
 */
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Chromium with a phone viewport and touch, for swipes (#245). No WebKit.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node e2e/fake-backend.mjs',
      url: `http://localhost:${BACKEND_PORT}/api/chapitres/3e/mathematiques/theoreme-de-pythagore`,
      env: { FAKE_BACKEND_PORT: String(BACKEND_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `next dev --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_INTERNAL_URL: `http://localhost:${BACKEND_PORT}` },
      reuseExistingServer: !process.env.CI,
      // The first compile of a page in `next dev` is slow on a cold CI runner.
      timeout: 180_000,
    },
  ],
})
