import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiPort = process.env.PORT ?? '4000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
    },
  },
  server: {
    port: 5173,
    // Same-origin API in dev: the browser only talks to Vite, which proxies /api.
    proxy: { '/api': { target: `http://localhost:${apiPort}`, changeOrigin: false } },
  },
  build: { outDir: 'dist', sourcemap: false },
})
