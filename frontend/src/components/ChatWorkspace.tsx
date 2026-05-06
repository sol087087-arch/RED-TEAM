import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { flushSync } from 'react-dom'
import chatHistoryIcon from '../assets/icons/actions/chat-history.png'
import clearKeyIcon from '../assets/icons/actions/clear5.png'
import downloadIcon from '../assets/icons/actions/download.png'
import loadIcon from '../assets/icons/actions/load.png'
import modeChatRobotIcon from '../assets/icons/actions/mode-chat-robot.png'
import redteamSwordsIcon from '../assets/icons/actions/redteam-swords.png'
import selectAllFilteredIcon from '../assets/icons/actions/select-all-filtered.png'
import type { GroupChatMessage, Model, RunSnapshot } from '../domain/types'
import type { ThemeMode } from './types'
import { LLM_PROVIDERS, detectProviderFromKey } from '../services/llmProviders'
import type { FilterDropdownItem } from './FilterDropdown'
import {
  displayModelTitleFirstLine,
  normalizeThreadDisplayText,
  stripBracketSpeakerPrefix,
} from '../features/chat/groupChatApiMessages'
import { providerVendorLabelFromModelId } from '../features/icons/modelProviderIcon'
import { useBrowserSpeechToText } from '../features/speech/useBrowserSpeechToText'
import { ChatModelPickerRows } from './ChatModelPickerRows'
import { ProviderIcon } from './ProviderIcon'
import { ThreadAssistantRichText } from '../features/chat/threadAssistantRichText'
import { extractComposerMentionQuery } from '../features/chat/composerMentionQuery'
import {
  FREE_OPEN_ROUTER_DISPLAY_MODEL_ID,
  pickListedFreeOpenRouterModel,
} from '../features/chat/exploreDefaultModel'
import { chatOrbSheenStyle, modelChipSheenStyle } from '../features/chat/modelChipSheen'
import type { StoredGroupChatSessionV1 } from '../features/chat/groupChatSessionHistory'

export type ChatKeyBalanceState =
  | { t: 'idle' }
  | { t: 'loading' }
  | { t: 'err'; msg: string }
  | {
      t: 'ok'
      /** USD shown in sidebar: account wallet when `/credits` works, else per-key remaining from `/key`. */
      remaining: number | null
      limit: number | null
      usage: number
      balanceSource: 'account' | 'key'
      accountTotalCredits?: number
      accountTotalUsage?: number
      /** Per-key `limit_remaining` when `balanceSource === 'account'` (often differs from wallet). */
      keyLimitRemaining?: number | null
    }

function extractFirstMediaFromContent(text: string): { url: string; kind: 'video' | 'audio' | 'image'; ext: string } | null {
  const videoMatch = /<video[^>]*\bsrc="([^"]+)"[^>]*>/i.exec(text)
  if (videoMatch?.[1]) return { url: videoMatch[1], kind: 'video', ext: 'mp4' }
  const audioMatch = /<audio[^>]*\bsrc="([^"]+)"[^>]*>/i.exec(text)
  if (audioMatch?.[1]) return { url: audioMatch[1], kind: 'audio', ext: 'mp3' }
  const imgMatch = /!\[[^\]]*\]\(([^)\s]+)\)/.exec(text)
  if (imgMatch?.[1]) {
    const url = imgMatch[1]
    const extMatch = /\.([a-z]{2,5})(?:[?#].*)?$/i.exec(url)
    return { url, kind: 'image', ext: extMatch?.[1]?.toLowerCase() ?? 'png' }
  }
  return null
}

/** Digits only. Whole dollars when possible, else one decimal. */
function formatUsdBalance(n: number | null): string {
  if (n === null) return '∞'
  const rounded = Math.round(n * 10) / 10
  const asInt = Math.round(rounded)
  if (Math.abs(rounded - asInt) < 1e-6) return String(asInt)
  return rounded.toFixed(1)
}

function sidebarBalanceDisplayText(state: ChatKeyBalanceState): string {
  if (state.t === 'loading') return '…'
  if (state.t === 'err') return '!'
  if (state.t === 'idle') return '-'
  if (state.remaining === null) return '∞'
  return `$${formatUsdBalance(state.remaining)}`
}

/** Stable keys for per-control hue (same hasher as model picker chips). */
const GROUP_CHAT_ORB_SHEEN = {
  addModel: 'groupChat:addModel',
  exportJson: 'groupChat:exportJson',
  closeChat: 'groupChat:closeChat',
  regenerateLine: 'groupChat:regenerateLine',
  copyLine: 'groupChat:copyLine',
  removeLine: 'groupChat:removeLine',
  historyRemoveCard: 'groupChat:historyRemoveCard',
} as const

type ChatWorkspaceProps = {
  theme: ThemeMode
  onToggleTheme: () => void
  clearKey: () => void
  setAppMode: (mode: 'redteam' | 'chat') => void
  keySaved: boolean
  keyInput: string
  setKeyInput: Dispatch<SetStateAction<string>>
  handleSaveKey: () => void | Promise<void>
  apiKeyPlaceholder: string
  llmProviderId: string
  setLlmProviderId: Dispatch<SetStateAction<string>>
  llmCustomBase: string
  setLlmCustomBase: Dispatch<SetStateAction<string>>
  chatInput: string
  setChatInput: Dispatch<SetStateAction<string>>
  models: readonly Model[]
  modelsLoading: boolean
  /** When true, only `guestDemoModelId` can be toggled; other picks show API key hint */
  modelPickRequiresApiKey?: boolean
  guestDemoModelId?: string
  keyGateFocusNonce?: number
  groupChatModelIds: readonly string[]
  toggleGroupChatModel: (model: Model) => void
  groupChatMessages: readonly GroupChatMessage[]
  groupChatSystemPrompt: string
  sendGroupChat: () => void | Promise<void>
  groupChatLoading: boolean
  removeGroupChatModelId: (modelId: string) => void
  clearGroupChat: () => void
  groupChatHistory: readonly StoredGroupChatSessionV1[]
  onRestoreGroupChatFromHistory: (sessionId: string) => void
  onRemoveGroupChatHistoryEntry: (sessionId: string) => void
  onRefreshGroupChatHistory: () => void
  keyBalance: ChatKeyBalanceState
  creditsPurchaseUrl: string
  billingEnabled: boolean
  feedbackUrl: string
  downloadAppUrl: string
  onRegenerateGroupChatLine?: (messageIndex: number) => void | Promise<void>
  regeneratingMessageIndex?: number | null
  onRemoveGroupChatMessage?: (messageIndex: number) => void
  /** Edit a user line: truncates the thread after it and fetches new assistant output. */
  onSubmitUserMessageEdit?: (messageIndex: number, newContent: string) => void | Promise<void>
  /** Sidebar Explore: append up to three random free / economy / standard-tier models. */
  onExploreAddThreeCheapModels: () => void
  /** When set, replaces chat hero + model picker (Red Team workspace). */
  workspaceVariant?: 'chat' | 'redteam'
  redTeamMain?: ReactNode
  /** Red Team run history — shown in the history panel when workspaceVariant === 'redteam'. */
  runHistory?: readonly RunSnapshot[]
  onLoadRunSnapshot?: (run: RunSnapshot) => void
  onRemoveRunSnapshot?: (runId: string) => void
}

type NavIcon = () => ReactElement

type NavItem = {
  id: string
  label: string
  /** Tooltip / aria when different from label */
  title?: string
  icon: NavIcon
  badge?: number
}

const NAV: NavItem[] = [
  { id: 'history', label: 'History', title: 'Chat history', icon: IconHistoryContinue },
  {
    id: 'explore',
    label: 'Explore',
    title: 'Pick 3 chip models',
    icon: IconExploreSelectAll,
  },
  { id: 'feedback', label: 'Send feedback', title: 'Email app feedback', icon: IconSendFeedbackNav },
  { id: 'download', label: 'Download Source ZIP', title: 'Download Source ZIP', icon: IconDownload },
]

export function ChatWorkspace(props: ChatWorkspaceProps) {
  const {
    theme,
    onToggleTheme,
    clearKey,
    setAppMode,
    keySaved,
    keyInput,
    setKeyInput,
    handleSaveKey,
    apiKeyPlaceholder,
    llmProviderId,
    setLlmProviderId,
    chatInput,
    setChatInput,
    models,
    modelsLoading,
    modelPickRequiresApiKey = false,
    guestDemoModelId = '',
    keyGateFocusNonce = 0,
    groupChatModelIds,
    toggleGroupChatModel,
    groupChatMessages,
    groupChatSystemPrompt,
    sendGroupChat,
    groupChatLoading,
    removeGroupChatModelId,
    clearGroupChat,
    groupChatHistory,
    onRestoreGroupChatFromHistory,
    onRemoveGroupChatHistoryEntry,
    onRefreshGroupChatHistory,
    keyBalance,
    creditsPurchaseUrl,
    billingEnabled,
    feedbackUrl,
    downloadAppUrl,
    onRegenerateGroupChatLine,
    regeneratingMessageIndex = null,
    onRemoveGroupChatMessage,
    onSubmitUserMessageEdit,
    onExploreAddThreeCheapModels,
    workspaceVariant = 'chat',
    redTeamMain,
    runHistory = [],
    onLoadRunSnapshot,
    onRemoveRunSnapshot,
  } = props


  const mastheadProviderItems = useMemo<FilterDropdownItem[]>(
    () => LLM_PROVIDERS.filter(p => p.id !== 'custom').map(p => ({
      value: p.id,
      labelShort: p.label,
      labelFull: p.label,
    })),
    [],
  )

  const mastheadKeyInputRef = useRef<HTMLInputElement | null>(null)
  const [mastheadKeyWrapFlash, setMastheadKeyWrapFlash] = useState(false)
  const [providerConfirmed, setProviderConfirmed] = useState(false)
  const [keySubmitted, setKeySubmitted] = useState(false)
  /** Local overrides while editing user lines in-place (cleared after submit or Escape). */
  const [userMsgDrafts, setUserMsgDrafts] = useState<Record<number, string>>({})

  useLayoutEffect(() => {
    if (keyGateFocusNonce === 0) return
    mastheadKeyInputRef.current?.focus({ preventScroll: false })
    setMastheadKeyWrapFlash(true)
    const t = window.setTimeout(() => setMastheadKeyWrapFlash(false), 1300)
    return () => window.clearTimeout(t)
  }, [keyGateFocusNonce])

  /** Warm decode for mode-toggle PNGs so mask layers aren’t cold on first mode switch. */
  useEffect(() => {
    const imgs: HTMLImageElement[] = []
    for (const src of [redteamSwordsIcon, modeChatRobotIcon]) {
      const img = new Image()
      imgs.push(img)
      const runDecode = () => void img.decode?.().catch(() => undefined)
      img.src = src
      if (img.complete) runDecode()
      else img.addEventListener('load', runDecode, { once: true })
    }
    return () => {
      for (const img of imgs) {
        img.src = ''
      }
    }
  }, [])

  useEffect(() => {
    setUserMsgDrafts(d => {
      let changed = false
      const n = { ...d }
      for (const k of Object.keys(n)) {
        const idx = Number(k)
        const msg = groupChatMessages[idx]
        if (!msg || msg.role !== 'user') {
          delete n[idx]
          changed = true
        }
      }
      return changed ? n : d
    })
  }, [groupChatMessages])

  const commitUserLineEdit = useCallback(
    async (index: number, raw: string) => {
      if (!onSubmitUserMessageEdit) return
      if (groupChatLoading || regeneratingMessageIndex !== null) return
      const msg = groupChatMessages[index]
      if (!msg || msg.role !== 'user') return
      if (!raw.trim()) return
      await onSubmitUserMessageEdit(index, raw)
      setUserMsgDrafts(prev => {
        const next = { ...prev }
        delete next[index]
        return next
      })
    },
    [
      groupChatLoading,
      regeneratingMessageIndex,
      groupChatMessages,
      onSubmitUserMessageEdit,
    ],
  )

  const handleCloseChat = useCallback(() => {
    clearGroupChat()
  }, [clearGroupChat])

  const [historyPanelOpen, setHistoryPanelOpen] = useState(false)

  useEffect(() => {
    if (!historyPanelOpen) return
    const onKey = (e: { key: string }) => {
      if (e.key === 'Escape') setHistoryPanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [historyPanelOpen])

  useEffect(() => {
    const activeHistoryLength =
      workspaceVariant === 'redteam' ? runHistory.length : groupChatHistory.length
    if (activeHistoryLength === 0 && historyPanelOpen) {
      setHistoryPanelOpen(false)
    }
  }, [groupChatHistory.length, runHistory.length, historyPanelOpen, workspaceVariant])

  const sidebarNav = useMemo(() => {
    const themeEntry: NavItem = {
      id: 'theme',
      label: 'Theme',
      title: theme === 'dark' ? 'Light mode' : 'Dark mode',
      icon: theme === 'dark' ? IconSunSidebar : IconMoonSidebar,
    }
    const activeHistoryLength =
      workspaceVariant === 'redteam' ? runHistory.length : groupChatHistory.length
    const withBadges = NAV.map(item =>
      item.id === 'history'
        ? {
            ...item,
            title: workspaceVariant === 'redteam' ? 'Run history' : 'Chat history',
            badge: activeHistoryLength > 0 ? activeHistoryLength : undefined,
          }
        : item,
    )
    const history = withBadges.find(i => i.id === 'history')!
    const explore = withBadges.find(i => i.id === 'explore')!
    const feedback = withBadges.find(i => i.id === 'feedback')!
    const download = withBadges.find(i => i.id === 'download')!
    return [history, explore, themeEntry, feedback, download]
  }, [theme, groupChatHistory.length, runHistory.length, workspaceVariant])

  const scrollToModelPicker = useCallback(() => {
    if (workspaceVariant === 'redteam') {
      document.getElementById('redteam-explore-anchor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
      return
    }
    document.getElementById('chat-workspace-model-picker')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }, [workspaceVariant])

  const hasAssistantSideTurn = groupChatMessages.some(
    m => m.role === 'assistant' || m.role === 'provider_error',
  )
  /**
   * Header (model chips, export, close) + composer tweaks: after any assistant/error line,
   * or as soon as the user picked models with a saved key - so selections are visible before the first send.
   */
  const showChatWindowChrome = hasAssistantSideTurn || (keySaved && groupChatModelIds.length > 0)

  /** Hero-only: prompt box hover lift (same language as model chips) until user types something. */
  const prechatEmptyPromptHover = !showChatWindowChrome && chatInput.trim() === ''

  const composerMentionQuery = useMemo(() => extractComposerMentionQuery(chatInput), [chatInput])

  const defaultThreadMaxPx = () =>
    typeof window !== 'undefined' ? Math.min(Math.round(window.innerHeight * 0.45), 420) : 360

  const [threadMaxPx, setThreadMaxPx] = useState(defaultThreadMaxPx)
  const threadMaxPxRef = useRef(threadMaxPx)
  useEffect(() => {
    threadMaxPxRef.current = threadMaxPx
  }, [threadMaxPx])

  const threadResizeDrag = useRef<{ pointerId: number; startY: number; startMax: number } | null>(null)
  const unifiedThreadRef = useRef<HTMLDivElement>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  /** Logo + TeamTestHub row — masthead API strip matches this width (left edge of logo → right edge of title). */
  const brandRowRef = useRef<HTMLDivElement>(null)
  const [brandRowWidthPx, setBrandRowWidthPx] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = brandRowRef.current
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      if (w > 0) setBrandRowWidthPx(Math.round(w * 1000) / 1000)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** Keep newest messages in view without manual scrolling */
  useLayoutEffect(() => {
    const el = unifiedThreadRef.current
    if (!el) return
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight
    }
    scrollToBottom()
    requestAnimationFrame(scrollToBottom)
  }, [groupChatMessages, groupChatLoading, threadMaxPx])

  const onThreadResizePointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault()
    threadResizeDrag.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startMax: threadMaxPxRef.current,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onThreadResizePointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const d = threadResizeDrag.current
    if (!d || e.pointerId !== d.pointerId) return
    const dy = e.clientY - d.startY
    const minH = 120
    const maxH = Math.min(Math.round(window.innerHeight * 0.88), 920)
    const next = Math.max(minH, Math.min(maxH, d.startMax + dy))
    setThreadMaxPx(next)
  }, [])

  const onThreadResizePointerUp = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const d = threadResizeDrag.current
    if (!d || e.pointerId !== d.pointerId) return
    threadResizeDrag.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }, [])

  const onThreadResizeKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const step = 28
    const minH = 120
    const maxH = Math.min(Math.round(window.innerHeight * 0.88), 920)
    setThreadMaxPx(h => {
      const delta = e.key === 'ArrowDown' ? step : -step
      return Math.max(minH, Math.min(maxH, h + delta))
    })
  }, [])

  const guestUserTurns = groupChatMessages.filter(m => m.role === 'user').length
  const noUserMessagesYet = guestUserTurns === 0
  const autoFreeOpenRouterCandidate = useMemo(
    () => (keySaved ? pickListedFreeOpenRouterModel(models) : null),
    [keySaved, models],
  )
  const canSendGroup =
    !!chatInput.trim() &&
    !groupChatLoading &&
    (keySaved
      ? groupChatModelIds.length > 0 || !!autoFreeOpenRouterCandidate
      : groupChatModelIds.length > 0)

  const appendVoicePhrase = useCallback(
    (chunk: string) => {
      setChatInput(prev => {
        const base = prev.trimEnd()
        return base ? `${base} ${chunk}` : chunk
      })
    },
    [setChatInput],
  )

  const {
    supported: speechSupported,
    listening: speechListening,
    toggle: toggleSpeechListening,
  } = useBrowserSpeechToText(appendVoicePhrase)

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    if (canSendGroup) void sendGroupChat()
  }

  const downloadMediaFromLine = useCallback(
    (idx: number) => {
      const m = groupChatMessages[idx]
      if (!m || m.role !== 'assistant') return
      const text = normalizeThreadDisplayText(stripBracketSpeakerPrefix(m.content))
      const media = extractFirstMediaFromContent(text)
      if (!media) return
      const a = document.createElement('a')
      a.href = media.url
      a.download = `model-output.${media.ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    },
    [groupChatMessages],
  )

  const copyModelLineToClipboard = useCallback(
    async (idx: number) => {
      const m = groupChatMessages[idx]
      if (!m || (m.role !== 'assistant' && m.role !== 'provider_error')) return
      const text =
        m.role === 'provider_error'
          ? m.content
          : normalizeThreadDisplayText(stripBracketSpeakerPrefix(m.content))
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        try {
          const ta = document.createElement('textarea')
          ta.value = text
          ta.setAttribute('readonly', '')
          ta.style.position = 'fixed'
          ta.style.left = '-9999px'
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        } catch {
          /* ignore */
        }
      }
    },
    [groupChatMessages],
  )

  const exportConversationJson = useCallback(() => {
    if (groupChatMessages.length === 0) return
    const payload = {
      exportedAt: new Date().toISOString(),
      systemPrompt: groupChatSystemPrompt.trim() || undefined,
      modelIds: [...groupChatModelIds],
      messages: groupChatMessages.map(m => ({
        role: m.role,
        content:
          m.role === 'assistant'
            ? normalizeThreadDisplayText(stripBracketSpeakerPrefix(m.content))
            : m.content,
        ts: m.ts,
        ...(m.role === 'assistant' || m.role === 'provider_error'
          ? {
              authorModelId: m.authorModelId,
              authorModelName: m.authorModelName,
              ...(m.authorViaFreeOpenRouter ? { authorViaFreeOpenRouter: true } : {}),
            }
          : {}),
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-export-${Date.now()}.json`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [groupChatMessages, groupChatModelIds, groupChatSystemPrompt])

  const unifiedChatHero = (
<div className="chat-workspace__hero">
          <div
            className={[
              'chat-workspace__sticky-chat-foot',
              !showChatWindowChrome ? 'chat-workspace__sticky-chat-foot--prechat' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="chat-workspace__composer-shell chat-workspace__composer-shell--footer">
              <div className="chat-workspace__unified-chat-shell">
                <div
                  className={[
                    'chat-workspace__unified-chat-frame',
                    prechatEmptyPromptHover ? 'chat-workspace__unified-chat-frame--prechat-prompt-hover' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {showChatWindowChrome ? (
                    <div className="chat-workspace__chat-window-header" role="toolbar" aria-label="Chat window">
                      <div className="chat-workspace__chat-window-header-models" aria-label="Models in this chat">
                        {groupChatModelIds.map(id => {
                          const catalog = models.find(m => m.id === id)
                          const vendor = providerVendorLabelFromModelId(id)
                          const titleLine = displayModelTitleFirstLine(catalog?.name, id, vendor)
                          return (
                            <button
                              key={id}
                              type="button"
                              className="chat-workspace__header-model-chip"
                              onClick={() => removeGroupChatModelId(id)}
                              title={`${titleLine} - remove from chat`}
                              aria-label={`Remove ${titleLine} from chat`}
                            >
                              <span
                                className="chat-workspace__header-model-icon-orb chat-workspace__sheen-orb chat-workspace__sheen-orb--delegated"
                                aria-hidden
                                style={modelChipSheenStyle(id)}
                              >
                                <ProviderIcon
                                  modelId={id}
                                  size={22}
                                  className="chat-workspace__header-model-icon"
                                  tone="secondary"
                                />
                              </span>
                              <div className="chat-workspace__header-model-text">
                                <span className="chat-workspace__header-model-line1">{titleLine}</span>
                                <span className="chat-workspace__header-model-line2">from {vendor}</span>
                              </div>
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          className="chat-workspace__header-add-model chat-workspace__sheen-orb"
                          style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.addModel)}
                          onClick={scrollToModelPicker}
                          title="Add model - pick below"
                          aria-label="Add model - pick in the list below"
                        >
                          <IconPlus className="chat-workspace__orb-plus-svg" />
                        </button>
                      </div>
                      <div className="chat-workspace__chat-window-header-actions">
                        <button
                          type="button"
                          className="chat-workspace__window-orb chat-workspace__export-conversation-orb chat-workspace__sheen-orb"
                          style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.exportJson)}
                          onClick={exportConversationJson}
                          title="Export conversation (JSON)"
                          aria-label="Export conversation as JSON"
                        >
                          <span
                            className="chat-workspace__export-conversation-glyph"
                            style={{
                              WebkitMaskImage: `url(${downloadIcon})`,
                              maskImage: `url(${downloadIcon})`,
                            }}
                            aria-hidden
                          />
                        </button>
                        <button
                          type="button"
                          className="chat-workspace__window-orb chat-workspace__window-orb--close chat-workspace__sheen-orb"
                          style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.closeChat)}
                          onClick={handleCloseChat}
                          title="Close chat"
                          aria-label="Close chat"
                        >
                          <IconCloseChat className="chat-workspace__window-orb-icon" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="chat-workspace__unified-chat-card">
                  {groupChatMessages.length > 0 || groupChatLoading ? (
                    <>
                      <div
                        ref={unifiedThreadRef}
                        className="chat-workspace__unified-thread"
                        aria-label="Group chat messages"
                        style={{ maxHeight: threadMaxPx }}
                      >
                        {groupChatMessages.map((m, i) => {
                          const regenBusy = regeneratingMessageIndex === i
                          const showAiActions =
                            keySaved &&
                            (m.role === 'assistant' || m.role === 'provider_error') &&
                            (m.authorModelId || '').trim() !== '' &&
                            (m.authorModelId || '').trim() !== guestDemoModelId
                          const isModelSide =
                            m.role === 'assistant' || m.role === 'provider_error'
                          const prev = i > 0 ? groupChatMessages[i - 1] : undefined
                          const prevIsModelSide =
                            !!prev &&
                            (prev.role === 'assistant' || prev.role === 'provider_error')
                          const modelReplyContinues = isModelSide && prevIsModelSide
                          const assistantCopyText =
                            m.role === 'assistant'
                              ? normalizeThreadDisplayText(
                                  stripBracketSpeakerPrefix(m.content),
                                ).trim()
                              : ''
                          const mediaInfo = m.role === 'assistant'
                            ? extractFirstMediaFromContent(assistantCopyText)
                            : null
                          const showDownloadLine = mediaInfo !== null
                          const showCopyModelLine =
                            m.role === 'assistant' && assistantCopyText.length > 0 && !showDownloadLine

                          return m.role === 'user' ? (
                            <div key={`gc-${i}-${m.ts}-u`} className="chat-workspace__thread-line chat-workspace__thread-line--user">
                              <div className="chat-workspace__thread-line__content">
                                {onSubmitUserMessageEdit ? (
                                  <textarea
                                    className="chat-workspace__thread-user-msg-inline"
                                    value={userMsgDrafts[i] !== undefined ? userMsgDrafts[i]! : m.content}
                                    onChange={e =>
                                      setUserMsgDrafts(p => ({ ...p, [i]: e.target.value }))
                                    }
                                    onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                                      if (e.key === 'Escape') {
                                        e.preventDefault()
                                        setUserMsgDrafts(p => {
                                          const n = { ...p }
                                          delete n[i]
                                          return n
                                        })
                                        e.currentTarget.blur()
                                        return
                                      }
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        void commitUserLineEdit(i, e.currentTarget.value)
                                      }
                                    }}
                                    rows={1}
                                    spellCheck={false}
                                    autoComplete="off"
                                    readOnly={groupChatLoading || regeneratingMessageIndex !== null}
                                    aria-label="Your message. Enter saves and resends; Shift+Enter new line; Escape reverts."
                                  />
                                ) : (
                                  <div className="chat-workspace__thread-msg-copy">{m.content}</div>
                                )}
                              </div>
                              <span className="chat-workspace__thread-persona-orb" title="You">
                                <IconThreadUserOrb />
                              </span>
                            </div>
                          ) : m.role === 'provider_error' ? (
                            <div
                              key={`gc-${i}-${m.ts}-err-${m.authorModelId ?? 'x'}`}
                              className={[
                                'chat-workspace__thread-line',
                                'chat-workspace__thread-line--assistant',
                                'chat-workspace__thread-line--provider-error',
                                modelReplyContinues
                                  ? 'chat-workspace__thread-line--model-reply-continues'
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              role="alert"
                            >
                              <span
                                className="chat-workspace__thread-persona-orb"
                                title={m.authorModelName ?? m.authorModelId ?? ''}
                              >
                                <ProviderIcon
                                  modelId={
                                    m.authorViaFreeOpenRouter
                                      ? FREE_OPEN_ROUTER_DISPLAY_MODEL_ID
                                      : (m.authorModelId ?? '')
                                  }
                                  size={18}
                                  className="chat-workspace__thread-model-orb-icon"
                                />
                              </span>
                              <div className="chat-workspace__thread-line__content">
                                <div className="chat-workspace__thread-msg-copy chat-workspace__thread-msg-copy--error">
                                  {m.content}
                                </div>
                              </div>
                              {showAiActions ? (
                                <div className="chat-workspace__thread-ai-actions">
                                  {onRegenerateGroupChatLine ? (
                                    <button
                                      type="button"
                                      className={[
                                        'chat-workspace__thread-regenerate',
                                        'chat-workspace__sheen-orb',
                                        regenBusy ? 'chat-workspace__thread-regenerate--busy' : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' ')}
                                      style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.regenerateLine)}
                                      aria-label="Regenerate this reply"
                                      title="Regenerate this reply"
                                      disabled={groupChatLoading || regeneratingMessageIndex !== null}
                                      onClick={() => void onRegenerateGroupChatLine(i)}
                                    >
                                      <span className="chat-workspace__thread-regenerate-glyph" aria-hidden />
                                    </button>
                                  ) : null}
                                  {showDownloadLine ? (
                                    <button
                                      type="button"
                                      className="chat-workspace__thread-copy-msg chat-workspace__sheen-orb"
                                      style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.copyLine)}
                                      aria-label="Download media"
                                      title="Download media"
                                      onClick={() => downloadMediaFromLine(i)}
                                    >
                                      <span
                                        className="chat-workspace__thread-copy-msg-glyph"
                                        style={{
                                          WebkitMaskImage: `url(${loadIcon})`,
                                          maskImage: `url(${loadIcon})`,
                                        }}
                                        aria-hidden
                                      />
                                    </button>
                                  ) : showCopyModelLine ? (
                                    <button
                                      type="button"
                                      className="chat-workspace__thread-copy-msg chat-workspace__sheen-orb"
                                      style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.copyLine)}
                                      aria-label="Copy this reply"
                                      title="Copy reply text"
                                      disabled={groupChatLoading || regeneratingMessageIndex !== null}
                                      onClick={() => void copyModelLineToClipboard(i)}
                                    >
                                      <span className="chat-workspace__thread-copy-msg-glyph" aria-hidden />
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="chat-workspace__thread-clear-msg chat-workspace__sheen-orb"
                                    style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.removeLine)}
                                    aria-label="Remove this reply from the thread"
                                    title="Remove this reply"
                                    disabled={regeneratingMessageIndex === i}
                                    onClick={e => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      onRemoveGroupChatMessage?.(i)
                                    }}
                                  >
                                    <span className="chat-workspace__thread-clear-msg-glyph" aria-hidden />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div
                              key={`gc-${i}-${m.ts}-${m.authorModelId ?? 'a'}`}
                              className={[
                                'chat-workspace__thread-line',
                                'chat-workspace__thread-line--assistant',
                                modelReplyContinues
                                  ? 'chat-workspace__thread-line--model-reply-continues'
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              <span className="chat-workspace__thread-persona-orb" title={m.authorModelName ?? m.authorModelId}>
                                <ProviderIcon
                                  modelId={
                                    m.authorViaFreeOpenRouter
                                      ? FREE_OPEN_ROUTER_DISPLAY_MODEL_ID
                                      : (m.authorModelId ?? '')
                                  }
                                  size={18}
                                  className="chat-workspace__thread-model-orb-icon"
                                />
                              </span>
                              <div className="chat-workspace__thread-line__content">
                                <div className="chat-workspace__thread-msg-copy">
                                  <ThreadAssistantRichText
                                    text={normalizeThreadDisplayText(stripBracketSpeakerPrefix(m.content))}
                                  />
                                </div>
                              </div>
                              {showAiActions ? (
                                <div className="chat-workspace__thread-ai-actions">
                                  {onRegenerateGroupChatLine ? (
                                    <button
                                      type="button"
                                      className={[
                                        'chat-workspace__thread-regenerate',
                                        'chat-workspace__sheen-orb',
                                        regenBusy ? 'chat-workspace__thread-regenerate--busy' : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' ')}
                                      style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.regenerateLine)}
                                      aria-label="Regenerate this reply"
                                      title="Regenerate this reply"
                                      disabled={groupChatLoading || regeneratingMessageIndex !== null}
                                      onClick={() => void onRegenerateGroupChatLine(i)}
                                    >
                                      <span className="chat-workspace__thread-regenerate-glyph" aria-hidden />
                                    </button>
                                  ) : null}
                                  {showDownloadLine ? (
                                    <button
                                      type="button"
                                      className="chat-workspace__thread-copy-msg chat-workspace__sheen-orb"
                                      style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.copyLine)}
                                      aria-label="Download media"
                                      title="Download media"
                                      onClick={() => downloadMediaFromLine(i)}
                                    >
                                      <span
                                        className="chat-workspace__thread-copy-msg-glyph"
                                        style={{
                                          WebkitMaskImage: `url(${loadIcon})`,
                                          maskImage: `url(${loadIcon})`,
                                        }}
                                        aria-hidden
                                      />
                                    </button>
                                  ) : showCopyModelLine ? (
                                    <button
                                      type="button"
                                      className="chat-workspace__thread-copy-msg chat-workspace__sheen-orb"
                                      style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.copyLine)}
                                      aria-label="Copy this reply"
                                      title="Copy reply text"
                                      disabled={groupChatLoading || regeneratingMessageIndex !== null}
                                      onClick={() => void copyModelLineToClipboard(i)}
                                    >
                                      <span className="chat-workspace__thread-copy-msg-glyph" aria-hidden />
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="chat-workspace__thread-clear-msg chat-workspace__sheen-orb"
                                    style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.removeLine)}
                                    aria-label="Remove this reply from the thread"
                                    title="Remove this reply"
                                    disabled={regeneratingMessageIndex === i}
                                    onClick={e => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      onRemoveGroupChatMessage?.(i)
                                    }}
                                  >
                                    <span className="chat-workspace__thread-clear-msg-glyph" aria-hidden />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                        {groupChatLoading ? (
                          <p className="chat-workspace__unified-loading hint" aria-live="polite">
                            {!keySaved ? 'Local demo is replying…' : 'Waiting for models…'}
                          </p>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                  <div className="chat-workspace__unified-composer-row">
                    {!showChatWindowChrome ? (
                      <button
                        type="button"
                        className="chat-workspace__composer-icon workspace-ui-sheen"
                        style={chatOrbSheenStyle('composer:attach')}
                        aria-label="Attach"
                        title="Attach"
                      >
                        <IconPlus />
                      </button>
                    ) : null}
                    <label className="chat-workspace__composer-field">
                      <span className="visually-hidden">Message</span>
                      <textarea
                        ref={composerTextareaRef}
                        className="chat-workspace__composer-input"
                        rows={1}
                        placeholder={
                          !keySaved
                            ? 'Free local demo'
                            : noUserMessagesYet
                              ? 'Message or brief instructions…'
                              : 'Message…'
                        }
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={onComposerKeyDown}
                        spellCheck={false}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                      />
                    </label>
                    {speechSupported ? (
                      <button
                        type="button"
                        className={[
                          'chat-workspace__composer-icon',
                          'workspace-ui-sheen',
                          speechListening ? 'chat-workspace__composer-icon--listening' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={chatOrbSheenStyle('composer:mic')}
                        aria-label={speechListening ? 'Stop voice input' : 'Voice input'}
                        aria-pressed={speechListening}
                        title={
                          speechListening
                            ? 'Stop dictation'
                            : 'Dictate with microphone (browser speech recognition)'
                        }
                        onClick={toggleSpeechListening}
                      >
                        <IconMic />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="chat-workspace__composer-send workspace-ui-sheen"
                      style={chatOrbSheenStyle('composer:send')}
                      aria-label="Send"
                      title="Send"
                      disabled={!canSendGroup}
                      onClick={() => {
                        if (canSendGroup) void sendGroupChat()
                      }}
                    >
                      <IconArrowUp />
                    </button>
                  </div>
                  </div>
                </div>
                {showChatWindowChrome ? (
                  <button
                    type="button"
                    className="chat-workspace__composer-corner-grip"
                    aria-label="Resize chat messages area height"
                    title="Drag vertically to show more or fewer messages (↑↓ keys when focused)"
                    onPointerDown={onThreadResizePointerDown}
                    onPointerMove={onThreadResizePointerMove}
                    onPointerUp={onThreadResizePointerUp}
                    onPointerCancel={onThreadResizePointerUp}
                    onKeyDown={onThreadResizeKeyDown}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
  )

  return (
    <div className="chat-workspace">
      {historyPanelOpen ? (
        <button
          type="button"
          className="chat-workspace__history-backdrop"
          aria-label="Close history panel"
          onClick={() => setHistoryPanelOpen(false)}
        />
      ) : null}
      {historyPanelOpen ? (
        <aside
          className="chat-workspace__history-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-workspace-history-title"
          onClick={() => setHistoryPanelOpen(false)}
        >
          <div className="chat-workspace__history-drawer-head">
            <h2 id="chat-workspace-history-title" className="chat-workspace__history-drawer-title">
              {workspaceVariant === 'redteam' ? 'Run history' : 'Chat history'}
            </h2>
          </div>
          {workspaceVariant === 'redteam' ? (
            runHistory.length === 0 ? (
              <p className="chat-workspace__history-drawer-hint hint">No runs yet. Run a test to see history here.</p>
            ) : (
              <>
                <p className="chat-workspace__history-drawer-hint hint">
                  Last 20 runs from this session. Click to restore results.
                </p>
                <ul className="chat-workspace__history-list" onClick={e => e.stopPropagation()}>
                  {runHistory.map(run => {
                    const passCount = run.results.filter(r => r.status === 'pass').length
                    const blockCount = run.results.filter(
                      r => r.status === 'fail' || r.status === 'fail_story',
                    ).length
                    const errorCount = run.results.filter(r => r.status === 'error').length
                    return (
                      <li key={run.id} className="chat-workspace__history-item">
                        <button
                          type="button"
                          className="chat-workspace__history-item-open"
                          title="Restore this run's results"
                          onClick={() => {
                            onLoadRunSnapshot?.(run)
                            setHistoryPanelOpen(false)
                          }}
                        >
                          <span className="chat-workspace__history-item-title">{run.label}</span>
                          <span className="chat-workspace__history-item-meta">
                            {new Date(run.timestamp).toLocaleString()} · {run.modelCount} model
                            {run.modelCount === 1 ? '' : 's'}
                            {passCount > 0 ? ` · ${passCount} passed` : ''}
                            {blockCount > 0 ? ` · ${blockCount} blocked` : ''}
                            {errorCount > 0 ? ` · ${errorCount} error${errorCount === 1 ? '' : 's'}` : ''}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="chat-workspace__history-item-remove chat-workspace__sheen-orb"
                          style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.historyRemoveCard)}
                          aria-label="Remove from history"
                          title="Remove from history"
                          onClick={e => {
                            e.stopPropagation()
                            onRemoveRunSnapshot?.(run.id)
                          }}
                        >
                          <IconCloseChat className="chat-workspace__history-item-remove-icon" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )
          ) : groupChatHistory.length === 0 ? (
            <p className="chat-workspace__history-drawer-hint hint">No chats yet. Start a conversation to see history here.</p>
          ) : (
            <>
              <p className="chat-workspace__history-drawer-hint hint">
                Stored in this browser tab until you close the tab.
              </p>
              <ul className="chat-workspace__history-list" onClick={e => e.stopPropagation()}>
                {groupChatHistory.map(s => (
                  <li key={s.id} className="chat-workspace__history-item">
                    <button
                      type="button"
                      className="chat-workspace__history-item-open"
                      disabled={groupChatLoading}
                      title="Open this chat"
                      onClick={() => {
                        onRestoreGroupChatFromHistory(s.id)
                        setHistoryPanelOpen(false)
                      }}
                    >
                      <span className="chat-workspace__history-item-title">{s.title}</span>
                      <span className="chat-workspace__history-item-meta">
                        {new Date(s.savedAt).toLocaleString()} · {s.modelIds.length} model
                        {s.modelIds.length === 1 ? '' : 's'} · {s.messages.length} message
                        {s.messages.length === 1 ? '' : 's'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="chat-workspace__history-item-remove chat-workspace__sheen-orb"
                      style={chatOrbSheenStyle(GROUP_CHAT_ORB_SHEEN.historyRemoveCard)}
                      aria-label="Remove from history"
                      title="Remove from history"
                      onClick={e => {
                        e.stopPropagation()
                        onRemoveGroupChatHistoryEntry(s.id)
                      }}
                    >
                      <IconCloseChat className="chat-workspace__history-item-remove-icon" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      ) : null}
      <aside className="chat-workspace__sidebar" aria-label="Workspace">
        <div className="chat-workspace__sidebar-top-slot">
          <button
            type="button"
            className={[
              'chat-workspace__nav-btn',
              'chat-workspace__sheen-orb',
              workspaceVariant === 'redteam'
                ? 'chat-workspace__nav-btn--mode-toggle-chat'
                : 'chat-workspace__nav-btn--mode-toggle-swords',
            ].join(' ')}
            style={chatOrbSheenStyle('sidebar:nav:mode')}
            title={workspaceVariant === 'redteam' ? 'Chat' : 'Red Team'}
            aria-label={workspaceVariant === 'redteam' ? 'Switch to Chat' : 'Switch to Red Team'}
            onClick={() => setAppMode(workspaceVariant === 'redteam' ? 'chat' : 'redteam')}
          >
            <span className="chat-workspace__mode-toggle-icon-stack" aria-hidden>
              <span
                className="chat-workspace__nav-icon chat-workspace__nav-icon--mode-chat-robot"
                style={{
                  WebkitMaskImage: `url(${modeChatRobotIcon})`,
                  maskImage: `url(${modeChatRobotIcon})`,
                  opacity: workspaceVariant === 'redteam' ? 1 : 0,
                }}
              />
              <span
                className="chat-workspace__nav-icon chat-workspace__nav-icon--redteam-swords"
                style={{
                  WebkitMaskImage: `url(${redteamSwordsIcon})`,
                  maskImage: `url(${redteamSwordsIcon})`,
                  opacity: workspaceVariant === 'chat' ? 1 : 0,
                }}
              />
            </span>
          </button>
          {keySaved ? (
            <button
              type="button"
              className="chat-workspace__nav-btn chat-workspace__sheen-orb"
              style={chatOrbSheenStyle('sidebar:nav:clear-key')}
              title="Remove the saved API key from this browser tab (session only)"
              aria-label="Clear saved API key from this session"
              onClick={() => clearKey()}
            >
              <span
                className="chat-workspace__nav-icon chat-workspace__nav-icon--clear-key"
                aria-hidden
                style={{
                  WebkitMaskImage: `url(${clearKeyIcon})`,
                  maskImage: `url(${clearKeyIcon})`,
                }}
              />
            </button>
          ) : null}
        </div>
        {billingEnabled && creditsPurchaseUrl ? (
          <div className="chat-workspace__sidebar-billing" aria-label="OpenRouter credits">
            <button
              type="button"
              className="chat-workspace__sidebar-balance chat-workspace__sheen-orb"
              style={chatOrbSheenStyle('sidebar:balance')}
              title="Add credits or manage billing (new tab)"
              aria-label="Open credits or billing page in new tab"
              onClick={() => {
                window.open(creditsPurchaseUrl, '_blank', 'noopener,noreferrer')
              }}
            >
              <span className="chat-workspace__sidebar-balance-amount">{sidebarBalanceDisplayText(keyBalance)}</span>
            </button>
          </div>
        ) : null}
        <nav className="chat-workspace__nav" aria-label="Main navigation">
          {sidebarNav.map(item => (
            <button
              key={item.id}
              type="button"
              className={[
                'chat-workspace__nav-btn',
                'chat-workspace__sheen-orb',
                item.id === 'history' && historyPanelOpen ? 'chat-workspace__nav-btn--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={chatOrbSheenStyle(`sidebar:nav:${item.id}`)}
              title={item.title ?? item.label}
              aria-label={
                item.id === 'theme'
                  ? theme === 'dark'
                    ? 'Switch to light theme'
                    : 'Switch to dark theme'
                  : item.label
              }
              aria-pressed={item.id === 'history' ? historyPanelOpen : undefined}
              onClick={() => {
                if (item.id === 'history') {
                  onRefreshGroupChatHistory()
                  setHistoryPanelOpen(o => !o)
                  return
                }
                if (item.id === 'theme') {
                  onToggleTheme()
                  setHistoryPanelOpen(false)
                  return
                }
                if (item.id === 'explore') {
                  onExploreAddThreeCheapModels()
                  setHistoryPanelOpen(false)
                  requestAnimationFrame(() => {
                    if (workspaceVariant === 'redteam') {
                      document.getElementById('redteam-explore-anchor')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                      })
                      return
                    }
                    document.getElementById('chat-workspace-model-picker')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                    })
                  })
                  return
                }
                if (item.id === 'feedback') {
                  const u = feedbackUrl.trim()
                  if (!u) return
                  if (u.toLowerCase().startsWith('mailto:')) {
                    window.location.href = u
                  } else {
                    window.open(u, '_blank', 'noopener,noreferrer')
                  }
                  return
                }
                if (item.id === 'download') {
                  window.open(downloadAppUrl.trim(), '_blank', 'noopener,noreferrer')
                  return
                }
                setHistoryPanelOpen(false)
              }}
            >
              <span className="chat-workspace__nav-icon-wrap">
                <item.icon />
                {item.badge != null ? (
                  <span className="chat-workspace__nav-badge" aria-hidden>
                    {item.badge}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="chat-workspace__main">
        <div
          className={[
            'chat-workspace__masthead-brand-align',
            !keySaved && brandRowWidthPx != null
              ? 'chat-workspace__masthead-brand-align--key-prompt'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={
            brandRowWidthPx != null
              ? {
                  ['--chat-brand-row-px' as string]: `${brandRowWidthPx}px`,
                  ...(keySaved
                    ? { width: brandRowWidthPx, maxWidth: '100%' }
                    : {}),
                }
              : undefined
          }
        >
        {!keySaved ? (
          <header
            className="chat-workspace__masthead"
            aria-label="Workspace tools"
          >
            <div
              className={[
                'chat-workspace__masthead-inner',
                !showChatWindowChrome ? 'chat-workspace__masthead-inner--narrow-composer' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="chat-workspace__masthead-key">
                <form
                  className="chat-workspace__masthead-key-form"
                  autoComplete="off"
                  onSubmit={e => {
                    e.preventDefault()
                    setKeySubmitted(true)
                    void handleSaveKey()
                  }}
                >
                  <div className="chat-workspace__masthead-key-stack">
                    <div
                      className={[
                        'chat-workspace__masthead-key-composite',
                        'chat-workspace__masthead-key-composite--solo',
                        'workspace-ui-hover-soft',
                        'chrome-pill-surface',
                        mastheadKeyWrapFlash ? 'chat-workspace__masthead-key-composite--gate-flash' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="chat-workspace__masthead-key-line1">
                        <div className="chat-workspace__masthead-key-field-wrap chat-workspace__masthead-key-field-wrap--with-save chat-workspace__masthead-key-field-wrap--embedded">
                          <input
                            ref={mastheadKeyInputRef}
                            name="llm-api-key"
                            type="password"
                            className="api-key-section__input chat-workspace__masthead-key-input"
                            value={keyInput}
                            onChange={e => {
                              const val = e.target.value
                              setKeyInput(val)
                              setProviderConfirmed(false)
                              setKeySubmitted(false)
                              const detected = detectProviderFromKey(val)
                              if (detected) {
                                setLlmProviderId(detected)
                                setProviderConfirmed(true)
                              }
                            }}
                            placeholder={apiKeyPlaceholder}
                            spellCheck={false}
                            autoComplete="off"
                            autoCorrect="off"
                            aria-label="API key"
                            inputMode="text"
                          />
                          <button
                            type="submit"
                            className="chat-workspace__masthead-key-submit workspace-ui-sheen"
                            style={chatOrbSheenStyle('masthead:key-save')}
                            disabled={modelsLoading || (keyInput.trim() !== '' && !providerConfirmed)}
                            aria-label={modelsLoading ? 'Verifying key' : 'Save and verify'}
                          >
                            {modelsLoading ? 'Verifying…' : 'Save and Verify'}
                          </button>
                        </div>
                      </div>
                    </div>
                    {keyInput.trim() !== '' && !keySubmitted && !providerConfirmed && (
                      <div className="chat-workspace__masthead-provider-panel" role="listbox" aria-label="Select API provider">
                        {mastheadProviderItems.map(item => (
                          <button
                            key={item.value}
                            type="button"
                            role="option"
                            aria-selected={llmProviderId === item.value && providerConfirmed}
                            className={[
                              'chat-workspace__masthead-provider-chip',
                              llmProviderId === item.value && providerConfirmed
                                ? 'chat-workspace__masthead-provider-chip--active'
                                : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => {
                              flushSync(() => {
                                setLlmProviderId(item.value)
                                setProviderConfirmed(true)
                                setKeySubmitted(true)
                              })
                              void handleSaveKey()
                            }}
                          >
                            {item.labelShort}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </header>
        ) : null}

        <div ref={brandRowRef} className="chat-workspace__brand">
          <span
            className="chat-workspace__logo"
            style={{
              WebkitMaskImage: 'url(/logo12.png)',
              maskImage: 'url(/logo12.png)',
            }}
            aria-hidden
          />
          <span className="chat-workspace__title">TeamTestHub</span>
        </div>
        </div>

        {workspaceVariant === 'redteam' && redTeamMain != null ? (
          <div className="chat-workspace__redteam-body">{redTeamMain}</div>
        ) : (
          <>
        {unifiedChatHero}

        <ChatModelPickerRows
          models={models}
          modelsLoading={modelsLoading}
          composerMentionQuery={composerMentionQuery}
          onPickModel={toggleGroupChatModel}
          selectedModelIds={new Set(groupChatModelIds)}
          modelPickRequiresApiKey={modelPickRequiresApiKey}
          guestDemoModelId={guestDemoModelId}
        />
          </>
        )}
        <p className="chat-workspace__privacy-footer" role="note">
          API keys and chats stay in your browser only. Nothing is stored by us.
        </p>
      </div>
    </div>
  )
}

function IconCloseChat({ className }: { className?: string }) {
  return (
    <svg
      className={['chat-workspace__svg', className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeWidth="2" d="M6 6l12 12M18 6l-12 12" />
    </svg>
  )
}

/** Person silhouette inside thread orb - same footprint as provider glyphs */
function IconThreadUserOrb() {
  return (
    <svg className="chat-workspace__svg chat-workspace__thread-user-orb-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="12" cy="9" r="3.25" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M6.5 19.5c.8-3 3.4-5 5.5-5s4.7 2 5.5 5" />
    </svg>
  )
}

/** Chat history sidebar glyph (`chat-history.png`, communications-style asset). */
function IconHistoryContinue() {
  return (
    <span
      className="chat-workspace__nav-icon chat-workspace__nav-icon--chat-history chat-workspace__nav-icon--glyph-90"
      aria-hidden
      style={{
        WebkitMaskImage: `url(${chatHistoryIcon})`,
        maskImage: `url(${chatHistoryIcon})`,
      }}
    />
  )
}

function IconExploreSelectAll() {
  return (
    <span
      className="chat-workspace__nav-icon chat-workspace__nav-icon--select-all-filtered chat-workspace__nav-icon--glyph-90"
      aria-hidden
      style={{
        WebkitMaskImage: `url(${selectAllFilteredIcon})`,
        maskImage: `url(${selectAllFilteredIcon})`,
      }}
    />
  )
}

/** Dark theme: show sun — click switches to light. */
function IconSunSidebar() {
  return (
    <span className="chat-workspace__nav-theme-icon" aria-hidden>
      ☀
    </span>
  )
}

/** Light theme: show moon — click switches to dark. */
function IconMoonSidebar() {
  return (
    <span className="chat-workspace__nav-theme-icon" aria-hidden>
      ☾
    </span>
  )
}

/** Send icon: slightly smaller, nudged toward bottom-left per sidebar spec. */
function IconSendFeedbackNav() {
  return (
    <span className="chat-workspace__nav-icon-feedback-wrap" aria-hidden>
      <IconSend />
    </span>
  )
}

function IconSend() {
  return (
    <svg className="chat-workspace__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg className="chat-workspace__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeWidth="2" d="M12 4v11m0 0l4-4m-4 4l-4-4M5 19h14" />
    </svg>
  )
}

function IconPlus({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      className={['chat-workspace__svg', className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeWidth={strokeWidth} d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconMic() {
  return (
    <svg className="chat-workspace__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeWidth="2"
        d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3zm6-3a6 6 0 01-12 0M12 19v3"
      />
    </svg>
  )
}

function IconArrowUp() {
  return (
    <svg className="chat-workspace__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

