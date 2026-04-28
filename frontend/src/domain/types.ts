export type ReplyStatus = 'pass' | 'fail' | 'fail_story' | 'unknown' | 'error'

/** Parsed from OpenRouter `/models` pricing (USD per token). */
export interface ModelPricing {
  promptPerTokenUsd: number
  completionPerTokenUsd: number
}

export interface Model {
  id: string
  name: string
  context_length?: number
  /** Present when the models API returned parseable `pricing` (base tier if tiered). */
  pricing?: ModelPricing
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
