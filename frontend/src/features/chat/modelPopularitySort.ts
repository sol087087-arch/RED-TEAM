import type { Model } from '../../domain/types'

/**
 * Rough “mindshare” order (OpenRouter-style leaderboards / flagship SKUs).
 * First matching prefix wins - list specific ids before shorter prefixes.
 * `~` = OpenRouter rolling aliases (~openai/gpt-mini-latest, etc.).
 */
const POPULARITY_PREFIX_ORDER: readonly string[] = [
  '~openai/gpt',
  'openai/gpt-5.5-pro',
  'openai/gpt-5.5',
  'openai/gpt-5.4',
  'openai/gpt-5.3',
  'openai/gpt-5.2',
  'openai/gpt-5',
  'openai/gpt-4.1',
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'openai/gpt-4-turbo',
  'openai/gpt-4',
  'openai/o4',
  'openai/o3',
  'openai/o1',

  '~anthropic/claude',
  'anthropic/claude-opus-4',
  'anthropic/claude-sonnet-4',
  'anthropic/claude-3-7-sonnet',
  'anthropic/claude-3-5-sonnet',
  'anthropic/claude-3-opus',
  'anthropic/claude-3-haiku',

  '~google/gemini',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'google/gemini-2.0',
  'google/gemini-1.5-pro',

  'x-ai/grok-4',
  'x-ai/grok-3',
  'x-ai/grok-2',

  'deepseek/deepseek-r1',
  'deepseek/deepseek-chat',
  'deepseek/deepseek-v3',

  'meta-llama/llama-4',
  'meta-llama/llama-3.3',
  'meta-llama/llama-3.2',
  'meta-llama/llama-3.1',

  'mistralai/mistral-large',
  'mistralai/mixtral',
  'mistralai/mistral-medium',

  'qwen/qwen3',
  'qwen/qwen2.5',

  'moonshotai/kimi-k2',
  'moonshotai/kimi',

  // Broad provider hints (after named families)
  'openai/',
  'anthropic/',
  'google/',
  'x-ai/',
  'deepseek/',
  'meta-llama/',
]

/** Pinned tiers are 0…; everything else sorts after + uses API list index. */
const UNPINNED_BASE = 100_000

function popularityTier(m: Model): number {
  const id = m.id
  for (let i = 0; i < POPULARITY_PREFIX_ORDER.length; i++) {
    if (id.startsWith(POPULARITY_PREFIX_ORDER[i])) return i
  }
  return UNPINNED_BASE + (m.listIndex ?? 999_999)
}

/**
 * Popular models first (pinned prefixes), then relative order from OpenRouter `/models`
 * response (`listIndex`), then stable id.
 */
export function compareModelsByPopularity(a: Model, b: Model): number {
  const ta = popularityTier(a)
  const tb = popularityTier(b)
  if (ta !== tb) return ta - tb
  const la = a.listIndex ?? 1e9
  const lb = b.listIndex ?? 1e9
  if (la !== lb) return la - lb
  return a.id.localeCompare(b.id)
}

export function sortModelsByPopularity(models: readonly Model[]): Model[] {
  return [...models].sort(compareModelsByPopularity)
}
