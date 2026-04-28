import type { Model, ModelPricing } from '../domain/types'
import { OPENROUTER_BASE, OPENROUTER_MAX_OUTPUT_TOKENS, openRouterHeaders, readOpenRouterError } from './openrouter'

export type ChatMessagePayload = { role: 'user' | 'assistant'; content: string }

function parseUsdTokenString(raw: unknown): number | undefined {
  if (typeof raw !== 'string') return undefined
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : undefined
}

/** OpenRouter may return a single tier or an array of tiers (long-context); use base tier for listing. */
function pricingFromApi(pricing: unknown): ModelPricing | undefined {
  if (pricing == null) return undefined
  const tier = Array.isArray(pricing) ? pricing[0] : pricing
  if (!tier || typeof tier !== 'object') return undefined
  const prompt = parseUsdTokenString((tier as { prompt?: unknown }).prompt)
  const completion = parseUsdTokenString((tier as { completion?: unknown }).completion)
  if (prompt === undefined || completion === undefined) return undefined
  return { promptPerTokenUsd: prompt, completionPerTokenUsd: completion }
}

export async function fetchOpenRouterModels(
  apiKey: string
): Promise<{ ok: true; models: Model[] } | { ok: false; status: number; detail: string }> {
  const response = await fetch(`${OPENROUTER_BASE}/models`, {
    headers: openRouterHeaders(apiKey),
  })
  if (!response.ok) {
    const detail = await readOpenRouterError(response)
    return { ok: false, status: response.status, detail }
  }
  const data = await response.json()
  const models: Model[] = (data.data || []).map((m: any) => ({
    id: m.id,
    name: m.name || m.id,
    context_length: m.context_length,
    pricing: pricingFromApi(m.pricing),
  }))
  return { ok: true, models }
}

export async function postOpenRouterChatCompletion(input: {
  apiKey: string
  model: string
  messages: ChatMessagePayload[]
  temperature: number
  maxTokens?: number
  signal?: AbortSignal
}): Promise<{
  ok: boolean
  status: number
  raw: string
  data: Record<string, unknown>
}> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: openRouterHeaders(input.apiKey, true),
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      max_tokens: input.maxTokens ?? OPENROUTER_MAX_OUTPUT_TOKENS,
      temperature: input.temperature,
    }),
    signal: input.signal,
  })

  const raw = await response.text()
  let data: Record<string, unknown> = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    // Keep empty object; caller can use raw for diagnostics.
  }

  return {
    ok: response.ok,
    status: response.status,
    raw,
    data,
  }
}
