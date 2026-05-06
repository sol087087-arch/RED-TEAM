import type { Model } from '../../domain/types'

/**
 * Classification of OpenRouter models for the home-page carousel rows.
 *
 * Image and video generation models are sourced from dedicated endpoints
 * (`/models?output_modalities=image` and `/videos/models`) that always carry
 * authoritative `output_modalities`, so we trust the API for those rows and
 * skip name-based heuristics — they produced false positives like `rekaai/reka-edge`
 * matching `/video` because its description mentioned "image/video inputs".
 *
 * Audio still benefits from heuristics: a few music/TTS models come through the
 * regular `/models` listing without a `audio`/`speech` modality flag.
 * Programming detection is purely heuristic (no API category).
 */

function modalities(m: Model): readonly string[] {
  return Array.isArray(m.outputModalities) ? m.outputModalities : []
}

function haystack(m: Model): string {
  return `${m.id}\n${m.name}\n${m.description ?? ''}`.toLowerCase()
}

/** Music / short audio clips (e.g. Google Lyria), TTS-heavy names. */
const AUDIO_HINTS: readonly string[] = [
  'lyria',
  '/lyria',
  'google/lyria',
  'lyria-3',
  'lyria_3',
  'lyria 3',
  'suno',
  'udio',
  'musicgen',
  'music-gen',
  'music_gen',
  'audio-gen',
  'audio_gen',
  'text-to-music',
  'text_to_music',
  'audio generation',
  'generate music',
  'music generation',
  'sound generation',
  'song generation',
  'voice synthesis',
  'elevenlabs',
  'eleven_labs',
  'gpt-audio',
  'gpt_audio',
  'gpt-4o-audio',
  'gpt-4o_audio',
]

/** Code- / dev-assistant style models (carousel “Programming” row). */
const PROGRAMMING_HINTS: readonly string[] = [
  'codex',
  ' copilot',
  'copilot/',
  '/copilot',
  'github-copilot',
  'starcoder',
  'codegen',
  'codellama',
  'code-llama',
  'code_llama',
  'deepseek-coder',
  'deepseek_coder',
  'qwen-coder',
  'qwen2.5-coder',
  'qwen3-coder',
  'codeqwen',
  'magicoder',
  'wizardcoder',
  'windsurf',
  'devin',
  'phind',
  'codegemma',
  'codeium',
  'grok-code',
  'x-ai/grok-code',
  'programming',
  'code-assist',
  'sql-coder',
  ' -coder',
  '/coder',
  'ollama/codellama',
  'code-dart',
  'code-fast-1',
  'code_supernova',
  'bigcode',
  'starcoder2',
]

function inferAudioMusicBot(m: Model): boolean {
  const h = haystack(m)
  return AUDIO_HINTS.some(s => h.includes(s.toLowerCase()))
}

export function inferProgrammingBot(m: Model): boolean {
  const h = haystack(m)
  return PROGRAMMING_HINTS.some(s => h.includes(s.toLowerCase()))
}

/**
 * OpenAI “Deep Research” long-horizon SKUs may list `video` in `output_modalities`
 * for upstream multimodal reasons — they are still text-only chat models.
 */
function isDeepResearchTextFamily(m: Model): boolean {
  const h = haystack(m)
  if (/\bdeep[-_\s]?research\b/i.test(h) || h.includes('deep_research')) return true
  if (/openai\/[^/\s]*deep[-_]?(research|search)/i.test(h)) return true
  return false
}

/** OpenRouter `/videos/models` populates `outputModalities: ['video']` via the catalog adapter. */
export function isVideoOutputModel(m: Model): boolean {
  if (isDeepResearchTextFamily(m)) return false
  return modalities(m).includes('video')
}

/** OpenRouter `/models?output_modalities=image` returns these with `architecture.output_modalities`. */
export function isImageOutputModel(m: Model): boolean {
  return modalities(m).includes('image')
}

/** `audio` / `speech` modalities (e.g. Lyria music clips), or audio-product naming. */
export function isAudioOutputModel(m: Model): boolean {
  const mods = modalities(m)
  if (mods.includes('audio') || mods.includes('speech')) return true
  return inferAudioMusicBot(m)
}

/** Any generation-oriented media model — exclude from the default “Text & chat” row. */
export function inferImageVideoBot(m: Model): boolean {
  return isVideoOutputModel(m) || isImageOutputModel(m) || isAudioOutputModel(m)
}

/** @deprecated kept for any external import; prefer the row-specific helpers. */
export type ModelOutputKind = 'text' | 'image_video'

/** @deprecated prefer inferImageVideoBot */
export function inferModelOutputKind(m: Model): ModelOutputKind {
  if (inferImageVideoBot(m)) return 'image_video'
  return 'text'
}
