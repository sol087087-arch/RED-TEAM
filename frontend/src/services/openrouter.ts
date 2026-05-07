/**
 * @deprecated Prefer `llmConfig` / `getLlmApiBase`. Kept for import stability.
 */
export {
  getLlmApiBase,
  llmRequestHeaders,
  readLlmApiError,
  LLM_MAX_OUTPUT_TOKENS,
  OPENROUTER_MAX_OUTPUT_TOKENS,
} from './llmConfig'

export { readLlmApiError as readOpenRouterError } from './llmConfig'
export { llmRequestHeaders as openRouterHeaders } from './llmConfig'
