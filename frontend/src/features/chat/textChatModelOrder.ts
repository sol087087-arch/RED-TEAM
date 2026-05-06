import type { Model } from '../../domain/types'
import { simplifyModelDisplayName } from './modelChipLabel'

/**
 * First horizontal row for "Text & chat": one pinned model per provider (OpenRouter-style id prefixes),
 * then everything else A→Z by display name.
 * Longer / more specific prefixes must appear before shorter ones that are prefixes of them.
 *
 * Intended roster: Anthropic (text & chat) → Cohere → xAI Grok 4.1 Fast → OpenAI GPT-5 Mini →
 * Google Gemini 2.5 Flash → DeepSeek V3.1 Terminus → Moonshot Kimi 2.5 → Minimax 2.5 → Qwen 235B.
 */
const TEXT_CHAT_PINNED_PREFIXES: readonly string[] = [
  'anthropic/claude-sonnet-4.5',
  /** Cohere Command family (legacy UI label “Clocksonet” / Command) */
  'cohere/command-a',
  'x-ai/grok-4.1-fast',
  'openai/gpt-5-mini',
  'google/gemini-2.5-flash',
  'deepseek/deepseek-v3.1-terminus',
  'moonshotai/kimi-k2.5',
  'minimax/minimax-m2.5',
  /** Matches `qwen3-235b-a22b` and similar slugs */
  'qwen/qwen3-235b',
]

const PINNED_TAIL = TEXT_CHAT_PINNED_PREFIXES.length

function normalizedIdForPin(id: string): string {
  return id.replace(/:(?:free|nitro|exacto)(?:-[\w-]+)?$/i, '')
}

/** Lowest index in TEXT_CHAT_PINNED_PREFIXES that matches, else PINNED_TAIL (sort after all pins). */
export function textChatPinnedIndex(m: Model): number {
  const id = normalizedIdForPin(m.id)
  for (let i = 0; i < TEXT_CHAT_PINNED_PREFIXES.length; i++) {
    if (id.startsWith(TEXT_CHAT_PINNED_PREFIXES[i])) return i
  }
  return PINNED_TAIL
}

function textChatSortKey(m: Model): string {
  const raw = (m.name || '').trim() || m.id
  const simplified = simplifyModelDisplayName(raw)
  return (simplified || raw).toLocaleLowerCase()
}

export function compareTextChatModels(a: Model, b: Model): number {
  const pa = textChatPinnedIndex(a)
  const pb = textChatPinnedIndex(b)
  if (pa !== pb) return pa - pb
  return textChatSortKey(a).localeCompare(textChatSortKey(b), undefined, { sensitivity: 'base' })
}

/** Full Text & chat carousel order: pinned roster first (when present), remainder A→Z. */
export function orderTextChatModels(models: readonly Model[]): Model[] {
  return [...models].sort(compareTextChatModels)
}
