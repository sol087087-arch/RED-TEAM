import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devProxy = {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  },
  // Same-origin proxy so browser calls OpenRouter without CORS issues
  '/openrouter-api': {
    target: 'https://openrouter.ai',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/openrouter-api/, '/api/v1'),
  },
} as const

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: devProxy,
  },
  preview: {
    proxy: devProxy,
  },
})
