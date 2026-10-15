import { defineConfig } from 'vitest/config'

// Takes the game manual's screenshots (docs/manual/images/) by playing the
// real game in headless Chromium, as the in-browser tests do: `npm run manual:screenshots`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/manual.shots.ts'],
    globalSetup: ['e2e/globalSetup.ts'],
    testTimeout: 300_000,
    hookTimeout: 60_000,
  },
})
