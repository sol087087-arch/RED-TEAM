import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devProxy = {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  },
  // Same-origin proxies: browser → `/…` → provider OpenAI-compatible `/v1` (avoids CORS).
  '/openrouter-api': {
    target: 'https://openrouter.ai',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/openrouter-api/, '/api/v1'),
  },
  '/llm-openai': {
    target: 'https://api.openai.com',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/llm-openai/, '/v1'),
  },
  '/llm-groq': {
    target: 'https://api.groq.com',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/llm-groq/, '/openai/v1'),
  },
  '/llm-together': {
    target: 'https://api.together.ai',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/llm-together/, '/v1'),
  },
  '/llm-fireworks': {
    target: 'https://api.fireworks.ai',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/llm-fireworks/, '/inference/v1'),
  },
  '/llm-deepinfra': {
    target: 'https://api.deepinfra.com',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/llm-deepinfra/, '/v1/openai'),
  },
  '/llm-deepseek': {
    target: 'https://api.deepseek.com',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/llm-deepseek/, '/v1'),
  },
  '/llm-kimi': {
    target: 'https://api.moonshot.ai',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/llm-kimi/, '/v1'),
  },
  '/llm-huggingface': {
    target: 'https://router.huggingface.co',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/llm-huggingface/, '/v1'),
  },
} as const

export default defineConfig({
  /* Relative asset URLs so dist works when opened from disk or deployed under a subpath */
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: devProxy,
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  preview: {
    proxy: devProxy,
  },
})
