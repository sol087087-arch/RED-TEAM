import type { Model } from '../../domain/types'

/** Coarse parameter scale for catalog browsing; not authoritative. */
export type ModelScaleBand = 'small' | 'medium' | 'large' | 'unknown'

/** Upper bound (billions of parameters) for the "small" bucket. Models below this are "small". */
export const SCALE_SMALL_MAX_B = 12.5
/** Lower bound for "large" bucket (billions). */
export const SCALE_LARGE_MIN_B = 70

function haystack(model: Pick<Model, 'id' | 'name'>): string {
  return `${model.id} ${model.name}`
}

/**
 * Best-effort parameter count in **billions** from id/name (OpenRouter does not expose params as a number).
 * Handles `70b`, `13.8b`, MoE `8x7b` (total experts × width as a rough total size).
 */
export function inferParameterBillions(model: Pick<Model, 'id' | 'name'>): number | null {
  const s = haystack(model)

  const moe = /\b(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*b\b/i.exec(s)
  if (moe) {
    const count = parseInt(moe[1], 10)
    const each = parseFloat(moe[2])
    if (Number.isFinite(count) && Number.isFinite(each) && count > 0 && each > 0 && each < 500) {
      return count * each
    }
  }

  let best = 0
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*-?\s*b\b/gi)) {
    const v = parseFloat(m[1])
    if (!Number.isFinite(v) || v <= 0 || v >= 10000) continue
    if (v > best) best = v
  }

  return best > 0 ? best : null
}

function inferScaleFromKeywords(model: Pick<Model, 'id' | 'name'>): ModelScaleBand {
  const h = haystack(model).toLowerCase()

  if (
    /\b(opus|405b|400b|gemini[^\s]*pro|gpt-5|gpt-4(?![\w]*mini)|o1-preview|o3\b|ultra\b|mistral-large|command-r-plus)\b/i.test(
      h
    ) ||
    /\b(llama[- ]?3\.?1[- ]?405|llama[- ]?4[- ]?\d)/i.test(h)
  ) {
    return 'large'
  }

  if (/\b(haiku|gpt-3\.5|gpt-4o-mini|gpt-4\.1-mini|gemini[^\s]*flash|phi-3|tiny|embed|rerank)\b/i.test(h)) {
    return 'small'
  }

  if (/\b(sonnet)\b/i.test(h) && !/\bopus\b/i.test(h)) return 'medium'

  return 'unknown'
}

/** Map inferred billions + keywords into small / medium / large / unknown. */
export function inferModelScaleBand(model: Pick<Model, 'id' | 'name'>): ModelScaleBand {
  const b = inferParameterBillions(model)
  if (b != null) {
    if (b < SCALE_SMALL_MAX_B) return 'small'
    if (b < SCALE_LARGE_MIN_B) return 'medium'
    return 'large'
  }
  return inferScaleFromKeywords(model)
}

function hasMoEPattern(model: Pick<Model, 'id' | 'name'>): boolean {
  return /\b\d+\s*[x×]\s*\d+(?:\.\d+)?\s*b\b/i.test(haystack(model))
}

function formatBillionsShort(b: number): string {
  if (b >= 100) return String(Math.round(b))
  const r = Math.round(b * 10) / 10
  if (Number.isInteger(r)) return String(r)
  return r.toFixed(1)
}

/**
 * Compact ~70B-style hint for model cards when id/name exposes a parameter count.
 * Omits qualitative labels (small/large); returns null when not inferrable from text.
 */
export function formatModelParameterSizeLabel(model: Pick<Model, 'id' | 'name'>): string | null {
  const b = inferParameterBillions(model)
  if (b == null) return null
  const core = formatBillionsShort(b)
  return hasMoEPattern(model) ? `~${core}B MoE` : `~${core}B`
}
