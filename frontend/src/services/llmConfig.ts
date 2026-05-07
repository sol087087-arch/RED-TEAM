import { getProviderInfo } from './llmProviders'

const APP_TITLE = 'TEAMTESTHUB'

function envOpenRouterBase(): string {
  const raw = import.meta.env.VITE_OPENROUTER_API_BASE
  if (typeof raw !== 'string' || !raw.trim()) return ''
  return raw.trim().replace(/\/$/, '')
}

const envMaxOut = import.meta.env.VITE_OPENROUTER_MAX_OUTPUT_TOKENS
function parseMaxOutputTokens(): number {
  const n = Number(envMaxOut)
  if (Number.isFinite(n) && n >= 256) return Math.min(131072, Math.floor(n))
  return 16384
}

export const LLM_MAX_OUTPUT_TOKENS = parseMaxOutputTokens()

/**
 * API base for chat + models (no trailing slash).
 * Custom: user supplies same-origin path you proxy to an OpenAI-compatible host, e.g. `/my-llm-proxy/v1`.
 */
export function getLlmApiBase(providerId: string, customRelativeBase?: string): string {
  if (providerId === 'openrouter') {
    const fromEnv = envOpenRouterBase()
    if (fromEnv) return fromEnv
  }
  if (providerId === 'custom') {
    const raw = (customRelativeBase || '').trim()
    if (raw) return raw.replace(/\/$/, '')
  }
  const info = getProviderInfo(providerId)
  if (info?.proxyPath) return info.proxyPath.replace(/\/$/, '')
  return '/openrouter-api'
}

export function llmRequestHeaders(providerId: string, apiKey: string, jsonBody = false): HeadersInit {
  const referer =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:5173'
  const h: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  }
  if (providerId === 'openrouter') {
    h['HTTP-Referer'] = referer
    h['X-OpenRouter-Title'] = APP_TITLE
  }
  if (jsonBody) h['Content-Type'] = 'application/json'
  return h
}

export async function readLlmApiError(response: Response): Promise<string> {
  const text = await response.text()
  try {
    const j = JSON.parse(text)
    const msg = j?.error?.message ?? j?.message
    if (msg) return String(msg)
  } catch {
    /* not JSON */
  }
  return text.slice(0, 400) || `HTTP ${response.status}`
}

/** @deprecated use LLM_MAX_OUTPUT_TOKENS */
export const OPENROUTER_MAX_OUTPUT_TOKENS = LLM_MAX_OUTPUT_TOKENS
