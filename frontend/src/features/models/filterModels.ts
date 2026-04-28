import type { Model } from '../../domain/types'
import { inferModelScaleBand } from './modelScaleBand'
import {
  formatApproxExchangeUsdRange,
  formatEconomyTierApprox,
  listedExchangeCostUsd,
} from '../../utils/formatOpenRouterPricing'

export type ModelMonetizationFilter = 'all' | 'free' | 'paid'
/** Tertiles by listed completion-token USD price within the current candidate set (after provider & access filters). */
export type ModelPriceBandFilter = 'all' | 'economy' | 'standard' | 'premium'
export type ModelScaleBandFilter = 'all' | 'small' | 'medium' | 'large'

export type ModelPriceSort = 'asc' | 'desc' | null

/** Segment before `/` in model id (OpenRouter provider namespace). */
export function modelProviderId(model: Model): string {
  const id = model.id
  const slash = id.indexOf('/')
  return slash === -1 ? id : id.slice(0, slash)
}

/** Listed $0 prompt and completion (OpenRouter free tier). */
export function isModelListedFree(m: Model): boolean {
  if (!m.pricing) return false
  return m.pricing.promptPerTokenUsd === 0 && m.pricing.completionPerTokenUsd === 0
}

export function applyStructuredModelFilters(
  models: readonly Model[],
  opts: {
    provider: string
    monetization: ModelMonetizationFilter
    priceBand: ModelPriceBandFilter
    /** Inferred from id/name (no param count in API). Omitted or `all` = no filter. */
    scaleBand?: ModelScaleBandFilter
  }
): Model[] {
  let list = [...models]
  const scale = opts.scaleBand ?? 'all'

  if (opts.provider !== 'all') {
    list = list.filter(m => modelProviderId(m) === opts.provider)
  }

  if (opts.monetization === 'free') {
    list = list.filter(isModelListedFree)
  } else if (opts.monetization === 'paid') {
    list = list.filter(m => !isModelListedFree(m))
  }

  if (scale !== 'all') {
    list = list.filter(m => inferModelScaleBand(m) === scale)
  }

  if (opts.priceBand !== 'all') {
    const priced = list.filter(m => m.pricing != null)
    const n = priced.length
    if (n === 0) {
      list = []
    } else {
      const sorted = [...priced].sort(
        (a, b) =>
          (a.pricing!.completionPerTokenUsd - b.pricing!.completionPerTokenUsd) ||
          a.id.localeCompare(b.id)
      )
      const b0 = Math.ceil(n / 3)
      const b1 = Math.ceil((2 * n) / 3)
      const want: 0 | 1 | 2 =
        opts.priceBand === 'economy' ? 0 : opts.priceBand === 'standard' ? 1 : 2
      const allowed = new Set<string>()
      for (let i = 0; i < n; i++) {
        const band: 0 | 1 | 2 = i < b0 ? 0 : i < b1 ? 1 : 2
        if (band === want) allowed.add(sorted[i].id)
      }
      list = list.filter(m => allowed.has(m.id))
    }
  }

  return list
}

/** Labels for tier dropdown rows: same tertile split as filtering; $/msg uses listed rates × LISTED_EXCHANGE_TOKEN_ASSUMPTION. */
export type PriceTertileOptionLabels = {
  economy: string
  standard: string
  premium: string
}

export function computeOutputPriceTertileLabels(
  modelsAfterFamilyAndAccess: readonly Model[]
): PriceTertileOptionLabels {
  type Priced = Model & { pricing: NonNullable<Model['pricing']> }
  const priced: Priced[] = modelsAfterFamilyAndAccess.filter((m): m is Priced => m.pricing != null)
  const n = priced.length

  if (n === 0) {
    return {
      economy: '—',
      standard: '—',
      premium: '—',
    }
  }

  const sorted = [...priced].sort(
    (a, b) =>
      a.pricing.completionPerTokenUsd - b.pricing.completionPerTokenUsd ||
      a.id.localeCompare(b.id)
  )

  const b0 = Math.ceil(n / 3)
  const b1 = Math.ceil((2 * n) / 3)

  const sliceExchangeRange = (
    start: number,
    end: number,
    formatRange: (lo: number, hi: number) => string
  ): string => {
    const seg = sorted.slice(start, end)
    if (seg.length === 0) return '—'
    const costs = seg
      .map(listedExchangeCostUsd)
      .filter((x): x is number => x != null && Number.isFinite(x))
      .map(x => Math.max(0, x))
    if (costs.length === 0) return '—'
    const lo = Math.min(...costs)
    const hi = Math.max(...costs)
    return formatRange(lo, hi)
  }

  return {
    economy: sliceExchangeRange(0, b0, formatEconomyTierApprox),
    standard: sliceExchangeRange(b0, b1, formatApproxExchangeUsdRange),
    premium: sliceExchangeRange(b1, n, formatApproxExchangeUsdRange),
  }
}

function isCheapToken(t: string): boolean {
  const x = t.toLowerCase()
  if (/^(cheap|cheaper|cheapest|inexpensive|budget|affordable|economy|economic)$/.test(x)) return true
  if (/^дешёв|^дешев|^недорог|^бюджет|^эконом/i.test(x)) return true
  return false
}

function isExpensiveToken(t: string): boolean {
  const x = t.toLowerCase()
  if (/^(expensive|costly|premium|luxury)$/.test(x)) return true
  if (/^дорог|^премиум/i.test(x)) return true
  return false
}

/** Recognize price-related words in the filter bar (EN/RU); strip them before substring search on id/name. */
export function detectModelPriceSort(filterRaw: string): ModelPriceSort {
  const trimmed = filterRaw.trim()
  if (!trimmed) return null

  const tokens = trimmed.split(/[\s,.;:!?/|()[\]{}'"`]+/).filter(Boolean)
  const cheap =
    tokens.some(isCheapToken) ||
    /\b(low[- ]cost|lowest[- ]price)\b/i.test(trimmed)
  const expensive =
    tokens.some(isExpensiveToken) ||
    /\b(high[- ]end|top[- ]tier)\b/i.test(trimmed)

  if (cheap && expensive) return null
  if (cheap) return 'asc'
  if (expensive) return 'desc'
  return null
}

export function stripModelPriceKeywords(filterRaw: string): string {
  let s = filterRaw.trim()
  s = s.replace(/\b(low[- ]cost|lowest[- ]price|budget[- ]friendly)\b/gi, ' ')
  const tokens = s.split(/[\s,.;:!?/|()[\]{}'"`]+/).filter(Boolean)
  const kept = tokens.filter(t => !isCheapToken(t) && !isExpensiveToken(t))
  s = kept.join(' ')
  s = s.replace(/\b(high[- ]end|top[- ]tier)\b/gi, ' ')
  return s.replace(/\s+/g, ' ').trim()
}

export function filterAndSortModels(models: readonly Model[], filterRaw: string): Model[] {
  const trimmed = filterRaw.trim()
  if (!trimmed) return [...models]

  const priceSort = detectModelPriceSort(trimmed)
  const textQuery = stripModelPriceKeywords(trimmed).toLowerCase()

  let list = [...models]
  if (textQuery) {
    list = list.filter(
      m =>
        m.id.toLowerCase().includes(textQuery) || m.name.toLowerCase().includes(textQuery)
    )
  }

  if (priceSort && list.some(m => m.pricing != null)) {
    list.sort((a, b) => {
      const pa = a.pricing?.completionPerTokenUsd ?? Number.POSITIVE_INFINITY
      const pb = b.pricing?.completionPerTokenUsd ?? Number.POSITIVE_INFINITY
      return priceSort === 'asc' ? pa - pb : pb - pa
    })
  }

  return list
}

const PROVIDER_DISPLAY: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  'meta-llama': 'Meta Llama',
  google: 'Google',
  mistralai: 'Mistral',
  deepseek: 'DeepSeek',
  'x-ai': 'xAI',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
}

/** Human-readable provider label for dropdowns (namespace segment of model id). */
export function formatModelProviderLabel(namespace: string): string {
  if (PROVIDER_DISPLAY[namespace]) return PROVIDER_DISPLAY[namespace]
  return namespace
    .split(/[-_]/)
    .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ')
}
