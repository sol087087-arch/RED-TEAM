import type { Model } from '../../domain/types'
import { applyStructuredModelFilters, isModelListedFree } from '../models/filterModels'
import { sortModelsByPopularity } from './modelPopularitySort'

/** UI-only model id - thread orb uses OpenRouter glyph (see `resolveSimpleIconForModelId`). */
export const FREE_OPEN_ROUTER_DISPLAY_MODEL_ID = 'teamtesthub/free-openrouter'

/**
 * For “Explore” quick-start: prefer a free-tier (listed $0) model by popularity, else first model in list.
 */
export function pickExploreStarterModel(models: readonly Model[]): Model | null {
  if (models.length === 0) return null
  const sorted = sortModelsByPopularity([...models])
  const free = sorted.find(m => isModelListedFree(m))
  if (free) return free
  return sorted[0] ?? null
}

/** Listed-free ($0) model only - for auto “Free Open Router” send (no paid fallback). */
export function pickListedFreeOpenRouterModel(models: readonly Model[]): Model | null {
  if (models.length === 0) return null
  const sorted = sortModelsByPopularity([...models])
  return sorted.find(m => isModelListedFree(m)) ?? null
}

function uniqueModelsById(list: readonly Model[]): Model[] {
  const seen = new Set<string>()
  const out: Model[] = []
  for (const m of list) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    out.push(m)
  }
  return out
}

/**
 * Random models for Explore: listed $0, economy tertile, or standard tertile only (never premium).
 * Models without pricing are excluded unless they are listed-free (which requires pricing).
 */
export function pickExploreCheapModels(models: readonly Model[], count: number): Model[] {
  if (models.length === 0 || count <= 0) return []
  const free = models.filter(isModelListedFree)
  const economy = applyStructuredModelFilters([...models], {
    provider: 'all',
    monetization: 'all',
    priceBand: 'economy',
    scaleBand: 'all',
  })
  const standard = applyStructuredModelFilters([...models], {
    provider: 'all',
    monetization: 'all',
    priceBand: 'standard',
    scaleBand: 'all',
  })
  const pool = sortModelsByPopularity(uniqueModelsById([...free, ...economy, ...standard]))
  if (pool.length === 0) return []
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, Math.min(count, shuffled.length))
}
