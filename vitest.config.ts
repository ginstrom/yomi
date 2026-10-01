import { defineConfig } from 'vitest/config'

// Domain code is Phaser-free and runs in plain Node; only the scene tests
// import Phaser, which needs a DOM and a canvas.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'domain',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: ['src/scenes/*Scene.test.ts'],
        },
      },
      {
        test: {
          name: 'scenes',
          environment: 'jsdom',
          setupFiles: ['vitest-canvas-mock'],
          // Each file would otherwise re-import Phaser in a fresh jsdom; the scene
          // tests don't mutate globals, so sharing one module graph is safe.
          isolate: false,
          include: ['src/scenes/*Scene.test.ts'],
        },
      },
    ],
  },
})
