/**
 * LLM backends with OpenAI-compatible `/v1/models` + `/v1/chat/completions`.
 * Browser calls use same-origin proxy paths (see vite.config.ts); production hosts must mirror those routes.
 */
export type LlmProviderId =
  | 'openrouter'
  | 'openai'
  | 'groq'
  | 'together'
  | 'fireworks'
  | 'deepinfra'
  | 'deepseek'
  | 'kimi'
  | 'huggingface'
  | 'custom'

export type LlmProviderInfo = {
  id: LlmProviderId
  /** UI */
  label: string
  /** Where users get API keys (empty for custom) */
  keysUrl: string
  /** Provider-hosted page to add credits (opens in a new tab; no payment on our origin). */
  creditsPurchaseUrl?: string
  /** Same-origin path proxied to provider (dev/preview) */
  proxyPath: string
  /** Key placeholder hint */
  keyPlaceholder: string
}

/**
 * Order: most common unified routers first, then direct hyperscaler-style APIs.
 * (Market share shifts; OpenRouter + OpenAI + Groq/Together/Fireworks cover most red-team lab use.)
 */
export const LLM_PROVIDERS: readonly LlmProviderInfo[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keysUrl: 'https://openrouter.ai/keys',
    creditsPurchaseUrl: 'https://openrouter.ai/credits',
    proxyPath: '/openrouter-api',
    keyPlaceholder: 'sk-or-v1-...',
  },
  {
    id: 'openai',
    label: 'OpenAI (direct)',
    keysUrl: 'https://platform.openai.com/api-keys',
    proxyPath: '/llm-openai',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'groq',
    label: 'Groq',
    keysUrl: 'https://console.groq.com/keys',
    proxyPath: '/llm-groq',
    keyPlaceholder: 'gsk_...',
  },
  {
    id: 'together',
    label: 'Together AI',
    keysUrl: 'https://api.together.ai/settings/api-keys',
    proxyPath: '/llm-together',
    keyPlaceholder: '...',
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    keysUrl: 'https://fireworks.ai/account/api-keys',
    proxyPath: '/llm-fireworks',
    keyPlaceholder: 'fw_...',
  },
  {
    id: 'deepinfra',
    label: 'DeepInfra',
    keysUrl: 'https://deepinfra.com/dash/api_keys',
    proxyPath: '/llm-deepinfra',
    keyPlaceholder: '...',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    keysUrl: 'https://platform.deepseek.com/',
    proxyPath: '/llm-deepseek',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    keysUrl: 'https://platform.kimi.ai/',
    proxyPath: '/llm-kimi',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    keysUrl: 'https://huggingface.co/settings/tokens',
    proxyPath: '/llm-huggingface',
    keyPlaceholder: 'hf_...',
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    keysUrl: '',
    proxyPath: '',
    keyPlaceholder: 'API key from your provider',
  },
] as const

export function getProviderInfo(id: string): LlmProviderInfo | undefined {
  return LLM_PROVIDERS.find(p => p.id === id)
}

export function normalizeLlmProviderId(raw: string | null | undefined): string {
  const s = (raw || 'openrouter').trim()
  return LLM_PROVIDERS.some(p => p.id === s) ? s : 'openrouter'
}

/** Detect provider from API key prefix. Returns undefined if key is too short to tell. */
export function detectProviderFromKey(key: string): LlmProviderId | undefined {
  const k = key.trim()
  if (!k || k.length < 6) return undefined
  if (k.startsWith('sk-or-')) return 'openrouter'   // OpenRouter — unique prefix
  if (k.startsWith('sk-proj-')) return 'openai'      // OpenAI project keys
  if (k.startsWith('gsk_')) return 'groq'
  if (k.startsWith('fw_')) return 'fireworks'
  if (k.startsWith('hf_')) return 'huggingface'
  if (k.startsWith('sk-')) return 'openai'           // legacy OpenAI keys
  return undefined
  // together/deepinfra/deepseek/kimi have no distinctive prefix → panel shown
}
