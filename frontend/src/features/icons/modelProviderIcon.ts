import type { SimpleIcon } from 'simple-icons'
import {
  siAnthropic,
  siChatbot,
  siClaude,
  siCloudflare,
  siDatabricks,
  siDeepseek,
  siDigitalocean,
  siElevenlabs,
  siGooglegemini,
  siHuggingface,
  siLangchain,
  siLanggraph,
  siMeta,
  siMinimax,
  siMistralai,
  siModal,
  siMoonshotai,
  siNim,
  siNvidia,
  siOllama,
  siOpenrouter,
  siPerplexity,
  siPytorch,
  siPython,
  siQwen,
  siReplicate,
  siSnowflake,
  siTensorflow,
  siVercel,
  siVllm,
  siX,
} from 'simple-icons'

import { FREE_OPEN_ROUTER_DISPLAY_MODEL_ID } from '../chat/exploreDefaultModel'
import { normalizeLlmProviderId, type LlmProviderId } from '../../services/llmProviders'
import { siChatgpt } from './chatgptIcon'

/** Default when namespace unknown - generic assistant glyph (OpenAI et al. often absent from Simple Icons). */
export const FALLBACK_MODEL_ICON = siChatbot

/**
 * Map OpenRouter-style namespace (`segment` before `/` in model id) → Simple Icon.
 * Keys must be lowercase.
 */
const NAMESPACE_ICON: Record<string, SimpleIcon> = {
  anthropic: siAnthropic,
  claude: siClaude,
  google: siGooglegemini,
  gemini: siGooglegemini,
  'meta-llama': siMeta,
  meta: siMeta,
  mistralai: siMistralai,
  mistral: siMistralai,
  moonshotai: siMoonshotai,
  moonshot: siMoonshotai,
  deepseek: siDeepseek,
  qwen: siQwen,
  'x-ai': siX,
  xai: siX,
  perplexity: siPerplexity,
  huggingface: siHuggingface,
  'huggingface.co': siHuggingface,
  hf: siHuggingface,
  openrouter: siOpenrouter,
  nvidia: siNvidia,
  ollama: siOllama,
  replicate: siReplicate,
  snowflake: siSnowflake,
  databricks: siDatabricks,
  vercel: siVercel,
  cloudflare: siCloudflare,
  minimax: siMinimax,
  nim: siNim,
  modal: siModal,
  vllm: siVllm,
  langchain: siLangchain,
  langgraph: siLanggraph,
  pytorch: siPytorch,
  tensorflow: siTensorflow,
  python: siPython,
  elevenlabs: siElevenlabs,
  openai: siChatgpt,
  chatgpt: siChatgpt,
  /** Groq / Together / Fireworks - no dedicated logo in Simple Icons v16 */
  groq: siChatbot,
  together: siChatbot,
  'togethercomputer': siChatbot,
  fireworks: siChatbot,
  deepinfra: siDigitalocean,
  baseten: siChatbot,
  runpod: siChatbot,
  anyscale: siChatbot,
}

function namespaceFromModelId(modelId: string): string {
  const slash = modelId.indexOf('/')
  if (slash !== -1) return modelId.slice(0, slash).trim().toLowerCase()
  return inferNamespaceFromBareId(modelId)
}

/** Heuristic when API returns bare ids (e.g. direct OpenAI: `gpt-4o`). */
function inferNamespaceFromBareId(modelId: string): string {
  const id = modelId.toLowerCase()
  if (/^(gpt-|o[134]|chatgpt|davinci|text-|tts-|whisper|dall-e)/.test(id) || /\bgpt-?\d/.test(id))
    return 'openai'
  if (id.includes('claude')) return 'anthropic'
  if (id.includes('gemini') || id.includes('palm') || id.startsWith('models/gemini')) return 'google'
  if (id.includes('llama') || id.includes('meta-llama')) return 'meta-llama'
  if (id.includes('mistral') || id.includes('mixtral') || id.includes('pixtral')) return 'mistralai'
  if (id.includes('deepseek')) return 'deepseek'
  if (id.includes('qwen')) return 'qwen'
  if (id.includes('grok') || id.includes('x-ai')) return 'x-ai'
  if (id.includes('kimi') || id.includes('moonshot')) return 'moonshotai'
  if (id.includes('gemma')) return 'google'
  return ''
}

function normalizeNs(ns: string): string {
  let n = ns.replace(/_/g, '-').toLowerCase()
  /** OpenRouter rolling aliases: `~openai/gpt-mini-latest` → namespace `~openai` → treat as `openai`. */
  if (n.startsWith('~')) n = n.slice(1)
  return n
}

/**
 * Resolve Simple Icons entry for a model id (e.g. `anthropic/claude-3-5-sonnet`, `gpt-4o`).
 */
export function resolveSimpleIconForModelId(modelId: string): SimpleIcon {
  if (modelId === FREE_OPEN_ROUTER_DISPLAY_MODEL_ID) return siOpenrouter
  let ns = normalizeNs(namespaceFromModelId(modelId))
  if (!ns) return FALLBACK_MODEL_ICON

  const direct = NAMESPACE_ICON[ns]
  if (direct) return direct

  /* longest-prefix style: nested paths like google/gemma */
  if (ns.includes('gemini') || ns.includes('google')) return siGooglegemini
  if (ns.includes('meta') || ns.includes('llama')) return siMeta
  if (ns.includes('mistral')) return siMistralai
  if (ns.includes('deepseek')) return siDeepseek
  if (ns.includes('qwen')) return siQwen
  if (ns.includes('moonshot') || ns.includes('kimi')) return siMoonshotai
  if (ns.includes('nvidia') || ns.endsWith('nim')) return siNvidia

  return FALLBACK_MODEL_ICON
}

/** Vendor label for chat header line 2 ("from …"). */
const NAMESPACE_VENDOR_LABEL: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  gemini: 'Google',
  'meta-llama': 'Meta',
  meta: 'Meta',
  mistralai: 'Mistral AI',
  mistral: 'Mistral AI',
  moonshotai: 'Moonshot',
  moonshot: 'Moonshot',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  'x-ai': 'xAI',
  xai: 'xAI',
  perplexity: 'Perplexity',
  huggingface: 'Hugging Face',
  'huggingface.co': 'Hugging Face',
  hf: 'Hugging Face',
  openrouter: 'OpenRouter',
  nvidia: 'NVIDIA',
  ollama: 'Ollama',
  replicate: 'Replicate',
  snowflake: 'Snowflake',
  databricks: 'Databricks',
  vercel: 'Vercel',
  cloudflare: 'Cloudflare',
  minimax: 'MiniMax',
  nim: 'NVIDIA',
  modal: 'Modal',
  vllm: 'vLLM',
  groq: 'Groq',
  together: 'Together AI',
  togethercomputer: 'Together AI',
  fireworks: 'Fireworks',
  deepinfra: 'DeepInfra',
  baseten: 'Baseten',
  runpod: 'RunPod',
  anyscale: 'Anyscale',
  elevenlabs: 'ElevenLabs',
  chatgpt: 'OpenAI',
  claude: 'Anthropic',
}

function titleCaseHyphenated(ns: string): string {
  return ns
    .split('-')
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Short vendor name derived from an OpenRouter-style model id (for UI subtitles).
 */
export function providerVendorLabelFromModelId(modelId: string): string {
  const trimmed = modelId.trim()
  if (!trimmed) return '-'
  const ns = normalizeNs(namespaceFromModelId(trimmed))
  if (ns) {
    const direct = NAMESPACE_VENDOR_LABEL[ns]
    if (direct) return direct
    if (ns.includes('gemini') || ns.includes('google')) return NAMESPACE_VENDOR_LABEL.google
    if (ns.includes('meta') || ns.includes('llama')) return NAMESPACE_VENDOR_LABEL['meta-llama']
    if (ns.includes('mistral')) return NAMESPACE_VENDOR_LABEL.mistralai
    if (ns.includes('deepseek')) return NAMESPACE_VENDOR_LABEL.deepseek
    if (ns.includes('qwen')) return NAMESPACE_VENDOR_LABEL.qwen
    if (ns.includes('moonshot') || ns.includes('kimi')) return NAMESPACE_VENDOR_LABEL.moonshotai
    if (ns.includes('nvidia') || ns.endsWith('nim')) return NAMESPACE_VENDOR_LABEL.nvidia
    return titleCaseHyphenated(ns)
  }
  return resolveSimpleIconForModelId(trimmed).title
}

const LLM_PROVIDER_ICON: Record<LlmProviderId, SimpleIcon> = {
  openrouter: siOpenrouter,
  openai: siChatgpt,
  groq: siChatbot,
  together: siChatbot,
  fireworks: siChatbot,
  deepinfra: siDigitalocean,
  deepseek: siDeepseek,
  kimi: siMoonshotai,
  huggingface: siHuggingface,
  custom: siChatbot,
}

/** Icon for active API backend (API key section / docs). */
export function resolveSimpleIconForLlmProviderId(providerId: string): SimpleIcon {
  const id = normalizeLlmProviderId(providerId) as LlmProviderId
  return LLM_PROVIDER_ICON[id] ?? siChatbot
}
