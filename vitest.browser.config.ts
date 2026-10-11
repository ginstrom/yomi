import { defineConfig } from 'vitest/config'

// The in-browser tests: Playwright drives the real game in headless Chromium,
// served by a Vite dev server that the global setup starts. Kept out of
// `npm test`, as they take seconds each and need a browser installed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/**/*.test.ts'],
    globalSetup: ['e2e/globalSetup.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
