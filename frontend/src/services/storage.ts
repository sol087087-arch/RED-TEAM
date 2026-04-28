import type { PromptTemplate, TestResult } from '../domain/types'

type SessionReadOptions = {
  storageKey: string
  defaultTemperature: number
  isValidTestResult: (r: unknown) => r is TestResult
  clampTemperature: (value: number) => number
}

export function readStoredSession(options: SessionReadOptions): {
  prompt: string
  results: TestResult[]
  temperature: number
  selectedModelIds: string[]
} {
  const { storageKey, defaultTemperature, isValidTestResult, clampTemperature } = options
  if (typeof localStorage === 'undefined') {
    return { prompt: '', results: [], temperature: defaultTemperature, selectedModelIds: [] }
  }
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw)
      return { prompt: '', results: [], temperature: defaultTemperature, selectedModelIds: [] }
    const data = JSON.parse(raw) as {
      prompt?: unknown
      results?: unknown
      temperature?: unknown
      selectedModelIds?: unknown
    }
    const prompt = typeof data.prompt === 'string' ? data.prompt : ''
    const results = Array.isArray(data.results)
      ? data.results.filter(isValidTestResult)
      : []
    const temperature =
      typeof data.temperature === 'number'
        ? clampTemperature(data.temperature)
        : defaultTemperature
    const selectedModelIds = Array.isArray(data.selectedModelIds)
      ? data.selectedModelIds.filter((x): x is string => typeof x === 'string')
      : []
    return { prompt, results, temperature, selectedModelIds }
  } catch {
    return { prompt: '', results: [], temperature: defaultTemperature, selectedModelIds: [] }
  }
}

export function loadPromptLibrary(storageKey: string): PromptTemplate[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data
      .filter((x): x is PromptTemplate => {
        if (!x || typeof x !== 'object') return false
        const o = x as Record<string, unknown>
        return (
          typeof o.id === 'string' &&
          typeof o.name === 'string' &&
          typeof o.prompt === 'string' &&
          Array.isArray(o.tags) &&
          typeof o.updatedAt === 'string'
        )
      })
      .slice(0, 200)
  } catch {
    return []
  }
}
