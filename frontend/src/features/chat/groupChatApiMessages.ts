import type { GroupChatMessage } from '../../domain/types'
import type { ChatMessagePayload } from '../../services/openrouterClient'
import { simplifyModelDisplayName } from './modelChipLabel'

/** OpenAI `name`: ^[a-zA-Z0-9_-]+$ , max 64 - derived from model id so providers can tell speakers apart. */
function chatMessageNameFromModelId(modelId: string): string {
  const s = modelId
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  const sliced = s.slice(0, 64)
  return sliced.length > 0 ? sliced : 'assistant'
}

/**
 * Legacy UI/API encoding put `[Label]: ` before assistant text in `content`; models echoed it.
 * Strip one leading bracket prefix when rendering old transcripts.
 */
export function stripBracketSpeakerPrefix(text: string): string {
  return text.replace(/^\[[^\]]+\]:\s*/, '')
}

/**
 * Thread uses `white-space: pre-wrap`, so each `\n` is a visible gap.
 * Collapse runs of 2+ newlines to a single `\n` so model “paragraph air” isn’t doubled blank bands.
 */
export function normalizeThreadDisplayText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trimEnd()
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Chat header line 1: model name only (no `Vendor: …` or repeated vendor before the title).
 */
export function displayModelTitleFirstLine(
  catalogName: string | undefined,
  modelId: string,
  vendorLabel: string,
): string {
  const stripVendorPrefix = (s: string): string => {
    let t = s.trim()
    if (!vendorLabel || vendorLabel === '-' || vendorLabel === '—') return t
    const re = new RegExp(`^${escapeRegExp(vendorLabel)}\\s*[:,—-]?\\s*`, 'i')
    t = t.replace(re, '').trim()
    return t
  }

  const raw = catalogName?.trim()
  if (raw) {
    let line = raw
    const colon = line.indexOf(':')
    if (colon !== -1 && colon < line.length - 1) {
      const rest = line.slice(colon + 1).trim()
      if (rest.length > 0) line = rest
    }
    line = stripVendorPrefix(line)
    const pick = line.length > 0 ? line : raw
    return simplifyModelDisplayName(pick)
  }

  const fid = modelId.trim()
  const slash = fid.indexOf('/')
  if (slash !== -1 && slash < fid.length - 1) return simplifyModelDisplayName(fid.slice(slash + 1).trim())
  return simplifyModelDisplayName(fid)
}

/**
 * Strip inline base64 data URIs from message content before sending to the API.
 * These can be hundreds of thousands of characters and blow through context limits.
 */
function stripBase64Media(content: string): string {
  return content
    .replace(/!\[([^\]]*)\]\(data:[^)]+\)/g, '[$1](generated image)')
    .replace(/\bsrc="data:[^"]+"/g, 'src="(generated media)"')
}

/** Maps shared transcript to provider messages; `name` distinguishes assistants without polluting `content`. */
export function buildGroupChatApiMessages(
  systemPrompt: string,
  messages: readonly GroupChatMessage[],
  opts?: { mediaModel?: boolean },
): ChatMessagePayload[] {
  const out: ChatMessagePayload[] = []
  const sys = systemPrompt.trim()
  if (sys) out.push({ role: 'system', content: sys })

  // Media models (image/video/audio) get only the last user message — no history bloat
  if (opts?.mediaModel) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        out.push({ role: 'user', content: messages[i].content })
        return out
      }
    }
    return out
  }

  for (const m of messages) {
    if (m.role === 'provider_error') continue
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content })
    } else {
      const mid = (m.authorModelId || '').trim()
      const payload: ChatMessagePayload = {
        role: 'assistant',
        content: stripBase64Media(m.content),
      }
      if (mid) payload.name = chatMessageNameFromModelId(mid)
      out.push(payload)
    }
  }
  return out
}
