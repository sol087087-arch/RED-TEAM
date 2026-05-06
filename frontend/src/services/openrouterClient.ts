import { sortModelsByPopularity } from '../features/chat/modelPopularitySort'
import type { Model, ModelPricing } from '../domain/types'
import {
  getLlmApiBase,
  LLM_MAX_OUTPUT_TOKENS,
  llmRequestHeaders,
  readLlmApiError,
} from './llmConfig'

export type ChatMessagePayload = {
  role: 'system' | 'user' | 'assistant'
  content: string
  /** OpenAI-style speaker id for multi-participant threads (a-z, A-Z, 0-9, underscore; max 64). */
  name?: string
}

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

/** OpenRouter models list: `architecture.output_modalities` e.g. text, image, video, audio. */
function outputModalitiesFromApi(m: Record<string, unknown>): string[] | undefined {
  const arch = m.architecture
  if (!arch || typeof arch !== 'object') return undefined
  const raw = (arch as { output_modalities?: unknown }).output_modalities
  if (!Array.isArray(raw)) return undefined
  const list = raw.filter((x): x is string => typeof x === 'string')
  return list.length ? list : undefined
}

/**
 * `/api/v1/videos/models` returns a different schema than `/api/v1/models`:
 * no `architecture`, no token-priced `pricing` — uses `pricing_skus` (per second / per clip).
 * We adapt to our `Model` type, force `outputModalities: ['video']` for routing.
 */
export function videoModelsFromOpenRouterJson(data: unknown): Model[] {
  const rawList = Array.isArray((data as { data?: unknown })?.data)
    ? ((data as { data: unknown[] }).data as Record<string, unknown>[])
    : []
  return rawList.map((m, listIndex): Model => {
    const id = typeof m.id === 'string' ? m.id : String(m.id ?? '')
    const name = typeof m.name === 'string' && m.name ? m.name : id
    const description = typeof m.description === 'string' ? m.description : undefined
    return {
      id,
      name,
      description,
      outputModalities: ['video'],
      listIndex: 100_000 + listIndex,
    }
  })
}

export type LlmClientContext = {
  providerId: string
  /** Required when providerId === 'custom': same-origin base path, e.g. `/my-proxy/v1` */
  customApiBase?: string
}

export function modelsFromOpenRouterJson(data: unknown): Model[] {
  const rawList = Array.isArray((data as { data?: unknown })?.data)
    ? ((data as { data: unknown[] }).data as Record<string, unknown>[])
    : []
  const models: Model[] = rawList.map((m: Record<string, unknown>, listIndex: number) => {
    const id = typeof m.id === 'string' ? m.id : String(m.id ?? '')
    const name = typeof m.name === 'string' && m.name ? m.name : id
    const context_length =
      typeof m.context_length === 'number'
        ? m.context_length
        : typeof m.context_window === 'number'
          ? m.context_window
          : undefined
    const pricing = pricingFromApi(m.pricing)
    const outputModalities = outputModalitiesFromApi(m)
    const description = typeof m.description === 'string' ? m.description : undefined
    return { id, name, context_length, pricing, outputModalities, description, listIndex }
  })
  return sortModelsByPopularity(models)
}

/**
 * OpenRouter splits its catalog across three endpoints: chat models at `/models`, image-output
 * models at `/models?output_modalities=image`, and video models at `/videos/models` (different
 * schema). Image and video catalogs may legitimately fail (free key, region) — we treat those
 * as empty rather than fatal, but a chat catalog failure aborts.
 */
async function fetchOpenRouterCatalog(
  baseHeaders: HeadersInit,
  signal?: AbortSignal,
): Promise<{ ok: true; models: Model[] } | { ok: false; status: number; detail: string }> {
  const base = getLlmApiBase('openrouter', undefined)
  const init: RequestInit = signal ? { headers: baseHeaders, signal } : { headers: baseHeaders }

  const [chatRes, imageRes, videoRes] = await Promise.all([
    fetch(`${base}/models`, init),
    fetch(`${base}/models?output_modalities=image`, init).catch(() => null),
    fetch(`${base}/videos/models`, init).catch(() => null),
  ])

  if (!chatRes.ok) {
    const detail = await readLlmApiError(chatRes)
    return { ok: false, status: chatRes.status, detail }
  }
  const chatModels = modelsFromOpenRouterJson(await chatRes.json())

  let imageModels: Model[] = []
  if (imageRes && imageRes.ok) {
    try {
      imageModels = modelsFromOpenRouterJson(await imageRes.json())
    } catch {
      /* tolerate */
    }
  }

  let videoModels: Model[] = []
  if (videoRes && videoRes.ok) {
    try {
      videoModels = videoModelsFromOpenRouterJson(await videoRes.json())
    } catch {
      /* tolerate */
    }
  }

  // Dedup by id; later entries lose to earlier (chat list wins), but image/video models
  // typically have unique ids, so the merge just appends them.
  const seen = new Set<string>()
  const merged: Model[] = []
  for (const m of [...chatModels, ...imageModels, ...videoModels]) {
    if (m.id && !seen.has(m.id)) {
      seen.add(m.id)
      merged.push(m)
    }
  }
  return { ok: true, models: sortModelsByPopularity(merged) }
}

/**
 * OpenRouter model catalog without an API key (same-origin `/openrouter-api` proxy in dev/preview).
 * If the upstream rejects unauthenticated requests, callers should fall back (e.g. demo-only model).
 */
export async function fetchOpenRouterModelsPublic(): Promise<
  { ok: true; models: Model[] } | { ok: false; status: number; detail: string }
> {
  const referer =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:5173'
  return fetchOpenRouterCatalog({
    'HTTP-Referer': referer,
    'X-OpenRouter-Title': 'TEAMTESTHUB',
  })
}

/** Parsed from OpenRouter `GET /v1/key` (per-key usage and remaining credits). */
export type OpenRouterKeyInfo = {
  label?: string
  limit: number | null
  limitRemaining: number | null
  usage: number
  isFreeTier?: boolean
}

/** Wallet balance from `GET /v1/credits`: purchased credits minus all-time usage (matches dashboard). */
export type OpenRouterCreditsInfo = {
  totalCredits: number
  totalUsage: number
  /** `totalCredits - totalUsage` in USD. */
  remaining: number
}

/** OpenRouter JSON often uses numbers; some proxies may stringify. */
function finiteNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * OpenRouter-only: account credits purchased vs used (`GET /v1/credits`).
 * May return 403 for keys that are not allowed to read account totals; callers should fall back to `/key`.
 */
const META_REQUEST_TIMEOUT_MS = 10_000

export async function fetchOpenRouterCredits(
  apiKey: string,
  ctx: LlmClientContext,
): Promise<{ ok: true; info: OpenRouterCreditsInfo } | { ok: false; status: number; detail: string }> {
  if (ctx.providerId !== 'openrouter') {
    return { ok: false, status: 400, detail: 'Credits endpoint is only for OpenRouter.' }
  }
  const base = getLlmApiBase(ctx.providerId, ctx.customApiBase)
  const response = await fetch(`${base}/credits`, {
    headers: llmRequestHeaders(ctx.providerId, apiKey),
    signal: AbortSignal.timeout(META_REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    const detail = await readLlmApiError(response)
    return { ok: false, status: response.status, detail }
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, status: 500, detail: 'Invalid JSON from /credits' }
  }
  const data =
    body && typeof body === 'object' && 'data' in body && (body as { data: unknown }).data
      ? ((body as { data: Record<string, unknown> }).data as Record<string, unknown>)
      : null
  if (!data || typeof data !== 'object') {
    return { ok: false, status: 500, detail: 'Missing data object from /credits' }
  }
  const totalCredits =
    finiteNum(data.total_credits) ?? finiteNum((data as { totalCredits?: unknown }).totalCredits)
  const totalUsage =
    finiteNum(data.total_usage) ?? finiteNum((data as { totalUsage?: unknown }).totalUsage)
  if (totalCredits === null || totalUsage === null) {
    return { ok: false, status: 500, detail: 'Missing total_credits or total_usage from /credits' }
  }
  return {
    ok: true,
    info: {
      totalCredits,
      totalUsage,
      remaining: totalCredits - totalUsage,
    },
  }
}

/**
 * OpenRouter-only: remaining credits on the current API key (`GET /v1/key`).
 * Other providers do not share this shape; callers should gate on `providerId === 'openrouter'`.
 */
export async function fetchOpenRouterKeyInfo(
  apiKey: string,
  ctx: LlmClientContext,
): Promise<{ ok: true; info: OpenRouterKeyInfo } | { ok: false; status: number; detail: string }> {
  if (ctx.providerId !== 'openrouter') {
    return { ok: false, status: 400, detail: 'Per-key balance is only available for OpenRouter.' }
  }
  const base = getLlmApiBase(ctx.providerId, ctx.customApiBase)
  const response = await fetch(`${base}/key`, {
    headers: llmRequestHeaders(ctx.providerId, apiKey),
    signal: AbortSignal.timeout(META_REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    const detail = await readLlmApiError(response)
    return { ok: false, status: response.status, detail }
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, status: 500, detail: 'Invalid JSON from /key' }
  }
  const data =
    body && typeof body === 'object' && 'data' in body && (body as { data: unknown }).data
      ? ((body as { data: Record<string, unknown> }).data as Record<string, unknown>)
      : null
  if (!data || typeof data !== 'object') {
    return { ok: false, status: 500, detail: 'Missing data object from /key' }
  }
  const limit = finiteNum(data.limit)
  const limitRemaining =
    finiteNum(data.limit_remaining) ??
    finiteNum((data as Record<string, unknown>).limitRemaining)
  const usage = finiteNum(data.usage) ?? 0
  const label = typeof data.label === 'string' ? data.label : undefined
  const isFreeTier = typeof data.is_free_tier === 'boolean' ? data.is_free_tier : undefined
  return {
    ok: true,
    info: {
      label,
      limit,
      limitRemaining,
      usage,
      isFreeTier,
    },
  }
}

export async function fetchLlmModels(
  apiKey: string,
  ctx: LlmClientContext
): Promise<{ ok: true; models: Model[] } | { ok: false; status: number; detail: string }> {
  if (ctx.providerId === 'openrouter') {
    return fetchOpenRouterCatalog(
      llmRequestHeaders(ctx.providerId, apiKey),
      AbortSignal.timeout(META_REQUEST_TIMEOUT_MS),
    )
  }
  const base = getLlmApiBase(ctx.providerId, ctx.customApiBase)
  const response = await fetch(`${base}/models`, {
    headers: llmRequestHeaders(ctx.providerId, apiKey),
    signal: AbortSignal.timeout(META_REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    const detail = await readLlmApiError(response)
    return { ok: false, status: response.status, detail }
  }
  const data: unknown = await response.json()
  return { ok: true, models: modelsFromOpenRouterJson(data) }
}

/** @deprecated use fetchLlmModels */
export async function fetchOpenRouterModels(apiKey: string): Promise<
  { ok: true; models: Model[] } | { ok: false; status: number; detail: string }
> {
  return fetchLlmModels(apiKey, { providerId: 'openrouter' })
}

/**
 * OpenRouter video generation: async job with polling. Concatenates user-role text from
 * the messages array as the prompt; system messages are merged in front since the videos
 * API does not have a system-role concept.
 */
const VIDEO_POLL_INTERVAL_MS = 4000
const VIDEO_POLL_MAX_MS = 5 * 60_000

function promptFromMessages(messages: readonly ChatMessagePayload[]): string {
  const sys: string[] = []
  const turns: string[] = []
  for (const m of messages) {
    if (!m.content) continue
    if (m.role === 'system') sys.push(m.content)
    else turns.push(m.content)
  }
  const head = sys.length ? `${sys.join('\n')}\n\n` : ''
  return `${head}${turns.join('\n\n')}`.trim()
}

function chatShapeFromVideoUrl(url: string, model: string): Record<string, unknown> {
  return {
    id: `video-${Date.now()}`,
    object: 'chat.completion',
    model,
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: [{ type: 'video_url', video_url: url }],
        },
      },
    ],
  }
}

function chatShapeFromError(message: string, model: string): Record<string, unknown> {
  return {
    id: `video-err-${Date.now()}`,
    object: 'chat.completion',
    model,
    error: { message, code: 'video_generation_failed' },
  }
}

async function postOpenRouterVideoGeneration(input: {
  apiKey: string
  model: string
  messages: ChatMessagePayload[]
  signal?: AbortSignal
} & LlmClientContext): Promise<{
  ok: boolean
  status: number
  raw: string
  data: Record<string, unknown>
}> {
  const base = getLlmApiBase('openrouter', undefined)
  const headers = llmRequestHeaders('openrouter', input.apiKey, true)
  const prompt = promptFromMessages(input.messages)
  if (!prompt) {
    return {
      ok: false,
      status: 400,
      raw: '',
      data: chatShapeFromError('Empty prompt — video generation needs a text description.', input.model),
    }
  }

  const submitRes = await fetch(`${base}/videos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: input.model, prompt }),
    signal: input.signal,
  })
  const submitRaw = await submitRes.text()
  if (!submitRes.ok) {
    let detail = submitRaw.slice(0, 400) || `HTTP ${submitRes.status}`
    try {
      const j = JSON.parse(submitRaw)
      const m = j?.error?.message ?? j?.message
      if (m) detail = String(m)
    } catch { /* not JSON */ }
    return {
      ok: false,
      status: submitRes.status,
      raw: submitRaw,
      data: chatShapeFromError(detail, input.model),
    }
  }
  let submitData: Record<string, unknown> = {}
  try {
    submitData = submitRaw ? JSON.parse(submitRaw) : {}
  } catch { /* keep empty */ }
  const jobId = typeof submitData.id === 'string' ? submitData.id : ''
  const pollingUrlRaw = typeof submitData.polling_url === 'string' ? submitData.polling_url : ''
  if (!jobId && !pollingUrlRaw) {
    return {
      ok: false,
      status: 502,
      raw: submitRaw,
      data: chatShapeFromError('Video job submission returned no id.', input.model),
    }
  }
  // Use same-origin proxy path; if API returns a fully qualified URL on openrouter.ai, rewrite.
  const pollUrl = pollingUrlRaw
    ? pollingUrlRaw.replace(/^https?:\/\/openrouter\.ai\/api\/v1/, base)
    : `${base}/videos/${encodeURIComponent(jobId)}`

  const startedAt = Date.now()
  for (;;) {
    if (input.signal?.aborted) {
      return {
        ok: false,
        status: 499,
        raw: '',
        data: chatShapeFromError('Video generation cancelled.', input.model),
      }
    }
    if (Date.now() - startedAt > VIDEO_POLL_MAX_MS) {
      return {
        ok: false,
        status: 504,
        raw: '',
        data: chatShapeFromError('Video generation timed out after 5 minutes.', input.model),
      }
    }
    await new Promise(r => setTimeout(r, VIDEO_POLL_INTERVAL_MS))

    const pollRes = await fetch(pollUrl, { headers, signal: input.signal })
    const pollRaw = await pollRes.text()
    if (!pollRes.ok) {
      // Transient — keep polling unless 4xx (client error)
      if (pollRes.status >= 400 && pollRes.status < 500) {
        let detail = pollRaw.slice(0, 400) || `HTTP ${pollRes.status}`
        try {
          const j = JSON.parse(pollRaw)
          const m = j?.error?.message ?? j?.message
          if (m) detail = String(m)
        } catch { /* not JSON */ }
        return {
          ok: false,
          status: pollRes.status,
          raw: pollRaw,
          data: chatShapeFromError(detail, input.model),
        }
      }
      continue
    }
    let pollData: Record<string, unknown> = {}
    try {
      pollData = pollRaw ? JSON.parse(pollRaw) : {}
    } catch { /* keep empty */ }
    const status = String(pollData.status ?? '').toLowerCase()
    if (status === 'completed') {
      const urls = Array.isArray(pollData.unsigned_urls) ? pollData.unsigned_urls : []
      const videoUrl = urls.find((u): u is string => typeof u === 'string' && u.length > 0)
      if (!videoUrl) {
        return {
          ok: false,
          status: 502,
          raw: pollRaw,
          data: chatShapeFromError('Video completed but no URL returned.', input.model),
        }
      }
      // Video content URLs require Authorization — fetch via same-origin proxy and return a blob URL
      // so the <video> element can load it without auth headers and without CSP issues.
      let playbackUrl = videoUrl
      try {
        const contentPath = videoUrl.replace(/^https?:\/\/openrouter\.ai\/api\/v1/, base)
        const contentRes = await fetch(contentPath, { headers, signal: input.signal })
        if (contentRes.ok) {
          const blob = await contentRes.blob()
          playbackUrl = URL.createObjectURL(blob)
        }
      } catch { /* fall through to raw URL */ }
      return {
        ok: true,
        status: 200,
        raw: pollRaw,
        data: chatShapeFromVideoUrl(playbackUrl, input.model),
      }
    }
    if (status === 'failed') {
      const err = (pollData.error && typeof pollData.error === 'object'
        ? (pollData.error as { message?: string }).message
        : null) ?? (typeof pollData.error === 'string' ? pollData.error : null)
      return {
        ok: false,
        status: 502,
        raw: pollRaw,
        data: chatShapeFromError(err || 'Video generation failed.', input.model),
      }
    }
    /* status: pending | processing — continue polling */
  }
}

export async function postLlmChatCompletion(
  input: {
    apiKey: string
    model: string
    messages: ChatMessagePayload[]
    temperature: number
    maxTokens?: number
    signal?: AbortSignal
    outputModalities?: readonly string[]
  } & LlmClientContext
): Promise<{
  ok: boolean
  status: number
  raw: string
  data: Record<string, unknown>
}> {
  const mods = input.outputModalities
  const isImageModel = mods != null && mods.includes('image')
  const isVideoModel = mods != null && mods.includes('video')

  // Video models on OpenRouter use a separate async API, not chat/completions.
  if (isVideoModel && input.providerId === 'openrouter') {
    return postOpenRouterVideoGeneration({
      apiKey: input.apiKey,
      model: input.model,
      messages: input.messages,
      signal: input.signal,
      providerId: input.providerId,
      customApiBase: input.customApiBase,
    })
  }

  const base = getLlmApiBase(input.providerId, input.customApiBase)
  const isMediaGen = isImageModel || isVideoModel
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
  }
  // Media-gen models reject temperature and max_tokens
  if (!isMediaGen) {
    body.max_tokens = input.maxTokens ?? LLM_MAX_OUTPUT_TOKENS
    body.temperature = input.temperature
  }
  if (isImageModel) {
    body.modalities = mods!.includes('text') ? ['text', 'image'] : ['image']
  }
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: llmRequestHeaders(input.providerId, input.apiKey, true),
    body: JSON.stringify(body),
    signal: input.signal,
  })

  const raw = await response.text()
  let data: Record<string, unknown> = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    /* keep empty */
  }

  return {
    ok: response.ok,
    status: response.status,
    raw,
    data,
  }
}

/** @deprecated use postLlmChatCompletion */
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
  return postLlmChatCompletion({ ...input, providerId: 'openrouter' })
}
