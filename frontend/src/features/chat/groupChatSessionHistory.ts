import type { GroupChatMessage } from '../../domain/types'

const STORAGE_KEY = 'teamtesthub:group-chat-session-history-v1'
const MAX_ENTRIES = 36

export type StoredGroupChatSessionV1 = {
  v: 1
  id: string
  savedAt: number
  title: string
  modelIds: string[]
  systemPrompt: string
  messages: GroupChatMessage[]
  composerDraft: string
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function isGroupChatMessage(x: unknown): x is GroupChatMessage {
  if (!isRecord(x)) return false
  const role = x.role
  if (role !== 'user' && role !== 'assistant' && role !== 'provider_error') return false
  if (typeof x.content !== 'string' || typeof x.ts !== 'number') return false
  return true
}

function isStoredSession(x: unknown): x is StoredGroupChatSessionV1 {
  if (!isRecord(x)) return false
  if (x.v !== 1) return false
  if (typeof x.id !== 'string' || typeof x.savedAt !== 'number' || typeof x.title !== 'string') return false
  if (!Array.isArray(x.modelIds) || !x.modelIds.every(id => typeof id === 'string')) return false
  if (typeof x.systemPrompt !== 'string' || typeof x.composerDraft !== 'string') return false
  if (!Array.isArray(x.messages) || !x.messages.every(isGroupChatMessage)) return false
  return true
}

export function readGroupChatSessionHistory(): StoredGroupChatSessionV1[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isStoredSession)
  } catch {
    return []
  }
}

function writeGroupChatSessionHistory(entries: StoredGroupChatSessionV1[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch (err) {
    console.warn('[storage] Failed to write chat history (quota or private mode)', err)
  }
}

export function sessionHistoryTitleFromMessages(messages: readonly GroupChatMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user')
  if (firstUser) {
    const t = firstUser.content.trim().replace(/\s+/g, ' ')
    if (!t) return 'Empty prompt'
    return t.length > 56 ? `${t.slice(0, 56)}...` : t
  }
  if (messages.some(m => m.role === 'assistant' || m.role === 'provider_error')) return 'Reply without user line'
  return 'Untitled chat'
}

export function shouldPersistGroupChatSnapshot(input: {
  messages: readonly GroupChatMessage[]
  modelIds: readonly string[]
  systemPrompt: string
  composerDraft: string
}): boolean {
  return (
    input.messages.length > 0 ||
    input.modelIds.length > 0 ||
    input.systemPrompt.trim() !== '' ||
    input.composerDraft.trim() !== ''
  )
}

export function appendGroupChatSessionSnapshot(input: {
  modelIds: readonly string[]
  systemPrompt: string
  messages: readonly GroupChatMessage[]
  composerDraft: string
  /** When closing a chat that was opened from history — replace that row instead of duplicating. */
  existingSessionId?: string | null
}): StoredGroupChatSessionV1[] {
  if (!shouldPersistGroupChatSnapshot(input)) {
    return readGroupChatSessionHistory()
  }
  const prev = readGroupChatSessionHistory()
  const replaceId =
    input.existingSessionId != null && input.existingSessionId !== ''
      ? prev.find(e => e.id === input.existingSessionId)?.id
      : undefined

  const id =
    replaceId ?? `gch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const entry: StoredGroupChatSessionV1 = {
    v: 1,
    id,
    savedAt: Date.now(),
    title: sessionHistoryTitleFromMessages(input.messages),
    modelIds: [...input.modelIds],
    systemPrompt: input.systemPrompt,
    messages: input.messages.map(m => ({ ...m })),
    composerDraft: input.composerDraft,
  }
  const rest = replaceId ? prev.filter(e => e.id !== replaceId) : prev
  const next = [entry, ...rest].slice(0, MAX_ENTRIES)
  writeGroupChatSessionHistory(next)
  return next
}

export function removeGroupChatSessionFromHistory(id: string): StoredGroupChatSessionV1[] {
  const prev = readGroupChatSessionHistory()
  const next = prev.filter(e => e.id !== id)
  writeGroupChatSessionHistory(next)
  return next
}
