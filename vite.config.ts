import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    watch: {
      // Bind mounts from the macOS host into the podman container don't
      // propagate inotify events, so Vite's watcher needs to poll instead.
      usePolling: true,
    },
  },
})
