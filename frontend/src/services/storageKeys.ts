/** Persisted after runs so reload keeps replies; cleared with "Clear results" or "Clear Key". */
export const SESSION_STORAGE_KEY = 'teamtesthub_test_session'
export const API_KEY_SESSION_STORAGE_KEY = 'openrouter_key_session'
/** `'openrouter' | 'openai' | …` - see `llmProviders.ts` */
export const LLM_PROVIDER_SESSION_KEY = 'teamtesthub_llm_provider'
/** Same-origin path for Custom provider, e.g. `/my-proxy/v1` */
export const LLM_CUSTOM_BASE_SESSION_KEY = 'teamtesthub_llm_custom_base'
/** `'redteam' | 'chat'` - chosen on section 1 */
export const APP_MODE_SESSION_KEY = 'teamtesthub_app_mode'
export const PRIVACY_MODE_STORAGE_KEY = 'teamtesthub_high_privacy_mode'
export const PROMPT_LIBRARY_STORAGE_KEY = 'teamtesthub_prompt_library_v1'
/** `'light'` | `'dark'` - UI color theme */
export const THEME_STORAGE_KEY = 'teamtesthub_theme'
/** Red Team run history — last 20 runs; sessionStorage so it survives reload but not tab close. */
export const RUN_HISTORY_SESSION_KEY = 'teamtesthub_run_history_v1'
