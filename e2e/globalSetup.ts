import { createServer } from 'vite'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    /** Where the dev server under test is listening. */
    baseUrl: string
  }
}

/** Serves the game for the whole run, on a port of its own so a dev server already up is left alone. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const server = await createServer({
    logLevel: 'warn',
    // Nothing changes under a test run, so nothing needs watching or reloading.
    server: { port: 5273, strictPort: false, watch: null, hmr: false },
  })
  await server.listen()
  project.provide('baseUrl', server.resolvedUrls!.local[0])
  return () => server.close()
}
