import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    watch: {
      // Docker Desktop bind mounts on Windows don't reliably forward inotify
      // events from host-side edits into the Linux container, so the default
      // watcher silently misses changes — poll instead.
      usePolling: true,
      interval: 300,
    },
    proxy: {
      // /api/* → http://localhost:8080/* (no CORS issues in dev)
      '/api': {
        // In Docker, the dev-server proxy must reach the backend container by
        // service name; VITE_API_PROXY_TARGET is set to that in docker-compose.yml.
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
