export type ReplyStatus = 'pass' | 'fail' | 'fail_story' | 'unknown' | 'error'

/** Parsed from OpenRouter `/models` pricing (USD per token). */
export interface ModelPricing {
  promptPerTokenUsd: number
  completionPerTokenUsd: number
}

/**
 * From OpenRouter `GET /models` → `architecture.output_modalities`
 * (text, image, video, audio, embeddings, etc.).
 */
export interface Model {
  id: string
  name: string
  context_length?: number
  /** Present when the models API returned parseable `pricing` (base tier if tiered). */
  pricing?: ModelPricing
  /** When API exposes architecture; use for image/video/audio rows instead of name heuristics only. */
  outputModalities?: string[]
  description?: string
  /** Position in `GET /models` `data` array (OpenRouter default listing order). */
  listIndex?: number
}

export interface TestResult {
  modelId: string
  modelName: string
  response: string
  error: string | null
  latencyMs: number | null
  status: ReplyStatus
  reason?: string
  /** Provider finish_reason (e.g. `length` = hit max_tokens, `stop` = model ended). */
  apiFinishReason?: string | null
  /** From API `usage.completion_tokens` when present (debug: not our truncation). */
  completionTokens?: number | null
  runId?: string
  runLabel?: string
}

export interface RunSnapshot {
  id: string
  label: string
  timestamp: string
  modelCount: number
  results: TestResult[]
}

export interface PromptTemplate {
  id: string
  name: string
  prompt: string
  tags: string[]
  updatedAt: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

/** Shared transcript for multi-model chat; assistants tagged so each model sees prior replies. */
export interface GroupChatMessage {
  role: 'user' | 'assistant' | 'provider_error'
  content: string
  ts: number
  /** When role is assistant or provider_error - which model this line refers to */
  authorModelId?: string
  authorModelName?: string
  /**
   * True when this line used an auto-picked listed-free OpenRouter model because the user
   * sent without selecting models (UI shows OpenRouter “free route” branding).
   */
  authorViaFreeOpenRouter?: boolean
}

export interface PromptClassify {
  primary_category: string
  confidence: number
  scores: Record<string, number>
  secondary_categories: string[]
  tags: string[]
  matched_rules: string[]
}

export type ResponseShapeSummary = {
  has_step_by_step: boolean
  has_materials_list: boolean
  has_quantities: boolean
  has_conditions: boolean
}
