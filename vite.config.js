import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During `vite dev`, proxy /api/* to `netlify dev` (port 8888) so the
// serverless functions work locally. In production Netlify handles the
// /api/* redirect itself (see netlify.toml), so this proxy is dev-only.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
