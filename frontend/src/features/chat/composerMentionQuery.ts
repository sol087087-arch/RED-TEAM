import type { Model } from '../../domain/types'

/**
 * Model-picker mention: token after the last `@` that starts a mention (line
 * start or whitespace before `@`), first word only. Skips `user@host` patterns.
 */
export function extractComposerMentionQuery(chatInput: string): string {
  const at = chatInput.lastIndexOf('@')
  if (at < 0) return ''
  if (at > 0 && !/\s/.test(chatInput.charAt(at - 1))) return ''
  const tail = chatInput.slice(at + 1)
  const word = tail.split(/\s/)[0] ?? ''
  return word.slice(0, 64).trim()
}

export function filterModelsByMentionToken(models: readonly Model[], token: string): Model[] {
  const q = token.trim().toLowerCase()
  if (!q) return []
  return models.filter(m => {
    const id = m.id.toLowerCase()
    const name = (m.name || '').toLowerCase()
    return id.includes(q) || name.includes(q)
  })
}
