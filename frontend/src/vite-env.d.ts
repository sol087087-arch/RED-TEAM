/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CF_ANALYTICS_BEACON_URL?: string
  /** Override OpenRouter API base (default: `/openrouter-api` — must be same-origin proxied). */
  readonly VITE_OPENROUTER_API_BASE?: string
  /** Max completion tokens per call (default 16384). */
  readonly VITE_OPENROUTER_MAX_OUTPUT_TOKENS?: string
}
