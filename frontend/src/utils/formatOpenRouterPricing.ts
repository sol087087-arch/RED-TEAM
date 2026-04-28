function maxFracForPerMillion(perMillion: number): number {
  if (perMillion < 0.01) return 4
  if (perMillion < 1) return 3
  if (perMillion < 100) return 2
  return 1
}

/** Currency figure only (USD per 1M output tokens), for ranges. */
export function formatUsdPerMOutputFigure(perTokenUsd: number): string {
  if (!Number.isFinite(perTokenUsd) || perTokenUsd < 0) return '—'
  if (perTokenUsd === 0) return '$0'
  const perMillion = perTokenUsd * 1e6
  const maxFrac = maxFracForPerMillion(perMillion)
  const rounded = Number(perMillion.toFixed(maxFrac))
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(rounded)
}

/** Listed assumption for catalog hints: heavier than a minimal turn (~5k tokens of content total). */
export const LISTED_EXCHANGE_TOKEN_ASSUMPTION = {
  promptTokens: 2500,
  completionTokens: 2500,
} as const

/** Approximate USD for one prompt + one reply using listed token rates and LISTED_EXCHANGE_TOKEN_ASSUMPTION. */
export function listedExchangeCostUsd(model: {
  pricing?: { promptPerTokenUsd: number; completionPerTokenUsd: number }
}): number | null {
  const p = model.pricing
  if (!p) return null
  const { promptTokens, completionTokens } = LISTED_EXCHANGE_TOKEN_ASSUMPTION
  const pi = Math.max(0, p.promptPerTokenUsd)
  const ci = Math.max(0, p.completionPerTokenUsd)
  return promptTokens * pi + completionTokens * ci
}

export function formatExchangeUsdFigure(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const v = Math.max(0, n)
  if (v === 0) return '$0'
  const maxFrac = v < 0.01 ? 4 : v < 1 ? 3 : v < 100 ? 2 : 2
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(Number(v.toFixed(maxFrac)))
}

/** Tier dropdown (Standard / Premium): approximate cost per one prompt + one reply. */
export function formatApproxExchangeUsdRange(lo: number, hi: number): string {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return '—'
  const a = Math.max(0, Math.min(lo, hi))
  const b = Math.max(0, Math.max(lo, hi))
  if (a === b) return `≈ ${formatExchangeUsdFigure(a)}/msg`
  return `≈ ${formatExchangeUsdFigure(a)} to ${formatExchangeUsdFigure(b)}/msg`
}

/** Economy tier: emphasize starting at $0 when the slice includes free/near-free listings. */
export function formatEconomyTierApprox(lo: number, hi: number): string {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return '—'
  const a = Math.max(0, Math.min(lo, hi))
  const b = Math.max(0, Math.max(lo, hi))
  const negligible = (x: number) => x <= 1e-12 || x < 5e-5
  if (negligible(a)) {
    if (negligible(b)) return `≈ ${formatExchangeUsdFigure(b)}/msg`
    return `≈ $0 to ~${formatExchangeUsdFigure(b)}/msg`
  }
  if (a === b) return `≈ ${formatExchangeUsdFigure(a)}/msg`
  return `≈ ${formatExchangeUsdFigure(a)} to ${formatExchangeUsdFigure(b)}/msg`
}

/** Retained for any $/M output displays outside tier dropdowns. */
export function formatApproxOutputRangeUsdPerM(lo: number, hi: number): string {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return '—'
  if (lo === hi) return `≈ ${formatUsdPerMillionOutputTokens(lo)}`
  return `≈ ${formatUsdPerMOutputFigure(lo)}–${formatUsdPerMOutputFigure(hi)}/M out`
}

/**
 * OpenRouter lists USD prices per token as strings. Display as $/1M output tokens for readability.
 */
export function formatUsdPerMillionOutputTokens(perTokenUsd: number): string {
  if (!Number.isFinite(perTokenUsd) || perTokenUsd < 0) return '—'
  if (perTokenUsd === 0) return 'free'
  const perMillion = perTokenUsd * 1e6
  const maxFrac = maxFracForPerMillion(perMillion)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(perMillion)
  return `${formatted}/M out`
}
