const APP_TITLE = 'TEAMTESTHUB'

/**
 * Same-origin path proxied to OpenRouter (see vite.config.ts).
 * Direct browser calls to https://openrouter.ai often fail with NetworkError (CORS) in production builds.
 * Deployments must forward `/openrouter-api` → `https://openrouter.ai/api/v1` (Cloudflare Worker, nginx, etc.),
 * or set `VITE_OPENROUTER_API_BASE` if you have another reachable base URL.
 */
const envBase = import.meta.env.VITE_OPENROUTER_API_BASE
export const OPENROUTER_BASE =
  typeof envBase === 'string' && envBase.trim() ? envBase.trim().replace(/\/$/, '') : '/openrouter-api'

/**
 * Max completion tokens per request. The app previously used 2000, which often stops mid-sentence
 * (finish_reason: length). Override with `VITE_OPENROUTER_MAX_OUTPUT_TOKENS` (256–131072).
 */
const envMaxOut = import.meta.env.VITE_OPENROUTER_MAX_OUTPUT_TOKENS
function parseMaxOutputTokens(): number {
  const n = Number(envMaxOut)
  if (Number.isFinite(n) && n >= 256) return Math.min(131072, Math.floor(n))
  return 16384
}
export const OPENROUTER_MAX_OUTPUT_TOKENS = parseMaxOutputTokens()

export function openRouterHeaders(apiKey: string, jsonBody = false): HeadersInit {
  const referer =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:5173'
  const h: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': referer,
    'X-OpenRouter-Title': APP_TITLE,
  }
  if (jsonBody) h['Content-Type'] = 'application/json'
  return h
}

export async function readOpenRouterError(response: Response): Promise<string> {
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
