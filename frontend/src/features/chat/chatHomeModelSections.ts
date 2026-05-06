import type { Model } from '../../domain/types'
import { sortModelsByPopularity } from './modelPopularitySort'
import { orderTextChatModels } from './textChatModelOrder'
import { isModelListedFree } from '../models/filterModels'
import {
  inferImageVideoBot,
  inferProgrammingBot,
  isAudioOutputModel,
  isImageOutputModel,
  isVideoOutputModel,
} from './modelOutputKind'

export type ChatModelSection = {
  id: string
  title: string
  models: Model[]
}

/**
 * Poe-style stacked carousels - full lists, no artificial caps.
 * Order: Text & chat → Free tier → Image → Video → Audio → Programming.
 *
 * Rows use OpenRouter `architecture.output_modalities` when present (`image` / `video` / `audio`),
 * else name/description substring hints (Lyria → audio clips, Kling → video, etc.).
 * Text & chat: pinned one model per provider (Claude → Cohere → Grok 4.1 Fast → GPT-5 Mini → … → Qwen 235B), then A→Z by label.
 * Other sections: popularity order.
 */
export function buildChatModelSections(models: readonly Model[]): ChatModelSection[] {
  const sorted = sortModelsByPopularity(models)

  const textChat = orderTextChatModels(
    sorted.filter(m => !inferImageVideoBot(m) && !inferProgrammingBot(m)),
  )

  const freeTier = sorted.filter(m => isModelListedFree(m))

  const imageBots = sorted.filter(isImageOutputModel)
  const videoBots = sorted.filter(isVideoOutputModel)
  const audioBots = sorted.filter(isAudioOutputModel)

  const programmingBots = sorted.filter(inferProgrammingBot)

  const sections: ChatModelSection[] = []

  if (textChat.length) {
    sections.push({ id: 'text', title: 'Text & chat', models: textChat })
  }

  if (freeTier.length) {
    sections.push({ id: 'free', title: 'Free tier', models: freeTier })
  }

  if (imageBots.length) {
    sections.push({ id: 'image', title: 'Image generation', models: imageBots })
  }

  if (videoBots.length) {
    sections.push({ id: 'video', title: 'Video & motion', models: videoBots })
  }

  if (audioBots.length) {
    sections.push({ id: 'audio', title: 'Audio & music', models: audioBots })
  }

  if (programmingBots.length) {
    sections.push({ id: 'programming', title: 'Programming bots', models: programmingBots })
  }

  if (sections.length === 0 && sorted.length) {
    sections.push({ id: 'all', title: 'Models', models: sorted })
  }

  return sections
}
