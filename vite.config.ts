import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    watch: {
      // Bind mounts from the macOS host into the podman container don't
      // propagate inotify events, so Vite's watcher needs to poll instead.
      usePolling: true,
      // Editors save via write-then-rename; without this, polling can catch
      // the file mid-swap and Vite briefly 404s on a transform.
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 20,
      },
    },
  },
})
