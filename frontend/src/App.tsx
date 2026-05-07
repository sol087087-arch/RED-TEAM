import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type {
  ChatMessage,
  GroupChatMessage,
  Model,
  PromptClassify,
  PromptTemplate,
  RunSnapshot,
  TestResult,
} from './domain/types'
import { buildCsvExport, buildJsonExport, buildMarkdownExport, generateRunId } from './features/export/reportExport'
import {
  buildUnrecognizedResponseNote,
  evaluateResponse,
  extractAssistantPayload,
  extractFromImagesApiData,
  isProviderOrUpstreamErrorContent,
  replyStatusLine,
  responseRealismTag,
  responseStatusBadgeClass,
  summarizeResponseShape,
  type Choice,
} from './features/eval/responseEval'
import {
  applyStructuredModelFilters,
  computeOutputPriceTertileLabels,
  filterAndSortModels,
  modelProviderId,
} from './features/models/filterModels'
import { buildGroupChatApiMessages } from './features/chat/groupChatApiMessages'
import { trySplitFirstComposerPrompt } from './features/chat/splitFirstComposerPrompt'
import {
  appendGroupChatSessionSnapshot,
  readGroupChatSessionHistory,
  removeGroupChatSessionFromHistory,
} from './features/chat/groupChatSessionHistory'
import {
  GUEST_DEMO_MODEL,
  GUEST_DEMO_MODEL_ID,
  guestDemoAssistantReply,
} from './features/chat/guestDemoModel'
import { chatOrbSheenStyle } from './features/chat/modelChipSheen'
import { pickExploreCheapModels, pickListedFreeOpenRouterModel } from './features/chat/exploreDefaultModel'
import { sortModelsByPopularity } from './features/chat/modelPopularitySort'
import { autoRunLabel, classifyPromptLocal, suggestTemplateMeta } from './features/heuristics/promptHeuristics'
import {
  ChatWorkspace,
  ResultsSection,
  RunSetupSection,
  type ChatKeyBalanceState,
} from './components'
import type { ThemeMode } from './components/types'
import type { AppMode } from './domain/appMode'
import { getProviderInfo, LLM_PROVIDERS, normalizeLlmProviderId } from './services/llmProviders'
import { LLM_MAX_OUTPUT_TOKENS } from './services/llmConfig'
import {
  fetchLlmModels,
  fetchOpenRouterCredits,
  fetchOpenRouterKeyInfo,
  fetchOpenRouterModelsPublic,
  postLlmChatCompletion,
} from './services/openrouterClient'
import { loadPromptLibrary, readStoredSession } from './services/storage'
import {
  API_KEY_SESSION_STORAGE_KEY,
  APP_MODE_SESSION_KEY,
  LLM_CUSTOM_BASE_SESSION_KEY,
  LLM_PROVIDER_SESSION_KEY,
  PRIVACY_MODE_STORAGE_KEY,
  PROMPT_LIBRARY_STORAGE_KEY,
  RUN_HISTORY_SESSION_KEY,
  SESSION_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from './services/storageKeys'
import './styles/index.css'

const DEFAULT_TEMPERATURE = 0.7
const TEMPERATURE_MIN = 0
const TEMPERATURE_MAX = 2
const MODEL_RESPONSE_TIMEOUT_MS = 3 * 60 * 1000
/** Clear saved API key after this much UI idle time (privacy). Skipped in Vite dev server (`npm run dev`). */
const KEY_IDLE_CLEAR_MS = 30 * 60 * 1000
const ANALYTICS_BEACON_URL = import.meta.env.VITE_CF_ANALYTICS_BEACON_URL

function clampTemperature(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_TEMPERATURE
  return Math.min(TEMPERATURE_MAX, Math.max(TEMPERATURE_MIN, value))
}

function isValidTestResult(r: unknown): r is TestResult {
  if (typeof r !== 'object' || r === null) return false
  const o = r as Record<string, unknown>
  return (
    typeof o.modelId === 'string' &&
    typeof o.modelName === 'string' &&
    typeof o.response === 'string' &&
    (o.error === null || typeof o.error === 'string') &&
    (o.latencyMs === null || typeof o.latencyMs === 'number') &&
    typeof o.status === 'string' &&
    ['pass', 'fail', 'fail_story', 'unknown', 'error'].includes(o.status) &&
    (o.reason === undefined || typeof o.reason === 'string') &&
    (o.apiFinishReason === undefined ||
      o.apiFinishReason === null ||
      typeof o.apiFinishReason === 'string') &&
    (o.completionTokens === undefined ||
      o.completionTokens === null ||
      typeof o.completionTokens === 'number')
  )
}

function isValidRunSnapshot(r: unknown): r is RunSnapshot {
  if (typeof r !== 'object' || r === null) return false
  const o = r as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.label === 'string' &&
    typeof o.timestamp === 'string' &&
    typeof o.modelCount === 'number' &&
    Array.isArray(o.results) &&
    (o.results as unknown[]).every(isValidTestResult)
  )
}

function readRunHistory(): RunSnapshot[] {
  try {
    const raw = sessionStorage.getItem(RUN_HISTORY_SESSION_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidRunSnapshot)
  } catch (err) {
    console.warn('[storage] Failed to read run history', err)
    return []
  }
}

function writeRunHistory(runs: RunSnapshot[]): void {
  try {
    sessionStorage.setItem(RUN_HISTORY_SESSION_KEY, JSON.stringify(runs))
  } catch (err) {
    console.warn('[storage] Failed to write run history (quota or private mode)', err)
  }
}

function parseCompletionTokensFromApiData(data: Record<string, unknown>): number | null {
  const u = data.usage
  if (!u || typeof u !== 'object') return null
  const c = (u as Record<string, unknown>).completion_tokens
  return typeof c === 'number' && Number.isFinite(c) ? c : null
}

function readStoredTheme(): ThemeMode {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY)
    if (t === 'dark' || t === 'light') return t
  } catch {
    /* ignore */
  }
  return 'dark'
}

function normalizeApiKeyInput(raw: string): string {
  return (
    raw
      // normalize common “smart” punctuation copied from chats/docs
      .replace(/[\u2018\u2019\u2032\uff07]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .trim()
  )
}

function isAscii(s: string): boolean {
  for (let i = 0; i < s.length; i += 1) {
    if (s.charCodeAt(i) > 0x7f) return false
  }
  return true
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map(t => t.trim().replace(/^#+/, '').toLowerCase())
    .filter(Boolean)
    .slice(0, 6)
}

type ExecuteModelChatArgs = {
  apiKey: string
  modelId: string
  modelName: string
  prompt: string
  temperature: number
  runId?: string
  runLabel?: string
  llm: { providerId: string; customApiBase?: string }
  externalSignal?: AbortSignal
  outputModalities?: readonly string[]
  contextLength?: number
}

async function executeModelChatRound(args: ExecuteModelChatArgs): Promise<TestResult> {
  const { apiKey, modelId, modelName, prompt, temperature, runId, runLabel, llm, externalSignal, outputModalities, contextLength } = args
  // Cap max_tokens so input + output never exceeds the model's context window.
  const maxTokens =
    typeof contextLength === 'number' && contextLength > 0
      ? Math.min(LLM_MAX_OUTPUT_TOKENS, contextLength - 1024)
      : Math.min(LLM_MAX_OUTPUT_TOKENS, 8192)
  const runMeta =
    runId !== undefined
      ? runLabel !== undefined
        ? { runId, runLabel }
        : { runId }
      : runLabel !== undefined
        ? { runLabel }
        : {}
  const startTime = Date.now()
  const ctrl = new AbortController()
  const timeoutId = window.setTimeout(() => ctrl.abort(), MODEL_RESPONSE_TIMEOUT_MS)
  let externalAbortHandler: (() => void) | null = null
  if (externalSignal) {
    if (externalSignal.aborted) {
      ctrl.abort()
    } else {
      externalAbortHandler = () => ctrl.abort()
      externalSignal.addEventListener('abort', externalAbortHandler, { once: true })
    }
  }

  try {
    const result = await postLlmChatCompletion({
      apiKey,
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      maxTokens,
      signal: ctrl.signal,
      providerId: llm.providerId,
      customApiBase: llm.customApiBase,
      outputModalities,
    })
    const latencyMs = Date.now() - startTime
    const data = result.data
    if (!result.raw && !result.ok) {
      return {
        modelId,
        modelName,
        response: '',
        error: `HTTP ${result.status} (empty response)`,
        latencyMs,
        status: 'error',
        ...runMeta,
      } as TestResult
    }
    if (!result.raw && result.ok) {
      return {
        modelId,
        modelName,
        response: '',
        error: `HTTP ${result.status} (empty response)`,
        latencyMs,
        status: 'error',
        ...runMeta,
      } as TestResult
    }

    if (result.ok) {
      const choices = data.choices as Choice[] | undefined
      let { text: content, finishReason, explicitRefusal } = extractAssistantPayload(choices?.[0])
      if (!content.trim()) content = extractFromImagesApiData(data)
      if (!content.trim() && result.raw) content = buildUnrecognizedResponseNote(data, result.raw)
      const completionTokens = parseCompletionTokensFromApiData(data)
      const evalResult = evaluateResponse(content, { finishReason, explicitRefusal, completionTokens })
      return {
        modelId,
        modelName,
        response: content,
        error: null,
        latencyMs,
        status: evalResult.status,
        reason: evalResult.reason,
        apiFinishReason: finishReason,
        completionTokens,
        ...runMeta,
      } as TestResult
    }
    const errObj = data.error as { message?: string } | undefined
    return {
      modelId,
      modelName,
      response: '',
      error: errObj?.message || (result.raw ? result.raw.slice(0, 300) : `HTTP ${result.status}`),
      latencyMs,
      status: 'error',
      reason: 'request error',
      ...runMeta,
    } as TestResult
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    return {
      modelId,
      modelName,
      response: '',
      error: aborted ? null : (error as Error).message,
      latencyMs: Date.now() - startTime,
      status: aborted ? 'unknown' : 'error',
      reason: aborted ? 'timeout empty response' : 'network/runtime error',
      ...runMeta,
    } as TestResult
  } finally {
    clearTimeout(timeoutId)
    if (externalSignal && externalAbortHandler) {
      externalSignal.removeEventListener('abort', externalAbortHandler)
    }
  }
}

async function executeGuestDemoTestRound(args: {
  modelId: string
  modelName: string
  prompt: string
  turnIndex: number
  runId?: string
  runLabel?: string
}): Promise<TestResult> {
  const { modelId, modelName, prompt, turnIndex, runId, runLabel } = args
  const runMeta =
    runId !== undefined
      ? runLabel !== undefined
        ? { runId, runLabel }
        : { runId }
      : runLabel !== undefined
        ? { runLabel }
        : {}
  const startTime = Date.now()
  await new Promise<void>(resolve => {
    window.setTimeout(resolve, 280)
  })
  const content = guestDemoAssistantReply(turnIndex, prompt)
  const evalResult = evaluateResponse(content, {
    finishReason: 'stop',
    explicitRefusal: false,
    completionTokens: null,
  })
  return {
    modelId,
    modelName,
    response: content,
    error: null,
    latencyMs: Date.now() - startTime,
    status: evalResult.status,
    reason: evalResult.reason,
    apiFinishReason: 'stop',
    completionTokens: null,
    ...runMeta,
  }
}

function App() {
  const cometBackdropRef = useRef<HTMLDivElement | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [llmProviderId, setLlmProviderId] = useState('openrouter')
  const [llmCustomBase, setLlmCustomBase] = useState('')
  const [highPrivacyMode, setHighPrivacyMode] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [prompt, setPrompt] = useState('')
  const [mutationEnabled, setMutationEnabled] = useState(false)
  const [mutationPrompt, setMutationPrompt] = useState('')
  const [mutationModelId, setMutationModelId] = useState('')
  const [results, setResults] = useState<TestResult[]>([])
  const [sessionHydrated, setSessionHydrated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelFilter, setModelFilter] = useState('')
  const [modelProviderFilter, setModelProviderFilter] = useState<string>('all')
  const [modelMonetizationFilter, setModelMonetizationFilter] = useState<
    'all' | 'free' | 'paid'
  >('all')
  const [modelPriceBandFilter, setModelPriceBandFilter] = useState<
    'all' | 'economy' | 'standard' | 'premium'
  >('all')
  const [modelScaleBandFilter, setModelScaleBandFilter] = useState<
    'all' | 'small' | 'medium' | 'large'
  >('all')
  const [errorMsg, setErrorMsg] = useState('')
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({})
  const [activeChatModelId, setActiveChatModelId] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState('')
  const [groupChatModelIds, setGroupChatModelIds] = useState<string[]>([])
  const [groupChatMessages, setGroupChatMessages] = useState<GroupChatMessage[]>([])
  const groupChatMessagesRef = useRef<GroupChatMessage[]>([])
  groupChatMessagesRef.current = groupChatMessages
  const [groupChatSystemPrompt, setGroupChatSystemPrompt] = useState('')
  const [groupChatLoading, setGroupChatLoading] = useState(false)
  const [regeneratingMessageIndex, setRegeneratingMessageIndex] = useState<number | null>(null)
  /** Set when opening a thread from Chat history; reused on close so history does not duplicate. */
  const [activeGroupChatSessionId, setActiveGroupChatSessionId] = useState<string | null>(null)
  const [promptClassify, setPromptClassify] = useState<PromptClassify | null>(null)
  const [classifyLoading, setClassifyLoading] = useState(false)
  const [classifyUnavailable, setClassifyUnavailable] = useState(false)
  const classifyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const classifyRequestId = useRef(0)
  /** Turn counter for Red Team runs against the local guest demo (no API key). */
  const redTeamGuestTurnRef = useRef(0)
  const currentRunIdRef = useRef<string | null>(null)
  const runAbortRef = useRef<AbortController | null>(null)

  const abortRun = useCallback(() => {
    runAbortRef.current?.abort()
    runAbortRef.current = null
  }, [])
  const balanceErrorCount = useRef(0)
  const copiedKeyTimerRef = useRef<number | null>(null)
  const [lastResultAt, setLastResultAt] = useState<number | null>(null)
  const [progressNow, setProgressNow] = useState(() => Date.now())
  const [runLabel, setRunLabel] = useState('')
  const [runLabelTouched, setRunLabelTouched] = useState(false)
  const [runHistory, setRunHistory] = useState<RunSnapshot[]>(() => readRunHistory())
  const [compareRunAId, setCompareRunAId] = useState('')
  const [compareRunBId, setCompareRunBId] = useState('')
  const [promptLibrary, setPromptLibrary] = useState<PromptTemplate[]>([])
  const [templateName, setTemplateName] = useState('')
  const [templateTagsInput, setTemplateTagsInput] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateNameTouched, setTemplateNameTouched] = useState(false)
  const [templateTagsTouched, setTemplateTagsTouched] = useState(false)
  const [retryingModels, setRetryingModels] = useState<string[]>([])
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme)
  const [appMode, setAppMode] = useState<AppMode>('chat')

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.dataset.theme = 'dark'
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    document.documentElement.style.setProperty('color-scheme', theme === 'dark' ? 'dark' : 'light')
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  useEffect(() => {
    const { prompt: p, results: r, temperature: t, selectedModelIds } = readStoredSession({
      storageKey: SESSION_STORAGE_KEY,
      defaultTemperature: DEFAULT_TEMPERATURE,
      isValidTestResult,
      clampTemperature,
    })
    setPrompt(p)
    setResults(r)
    setTemperature(t)
    if (selectedModelIds.length) setSelectedModels(new Set(selectedModelIds))
    // On reload with empty prompt, never keep stale derived labels/tags.
    if (!p.trim()) {
      setRunLabel('')
      setRunLabelTouched(false)
      setSelectedTemplateId('')
      setTemplateName('')
      setTemplateTagsInput('')
      setTemplateNameTouched(false)
      setTemplateTagsTouched(false)
    }
    setSessionHydrated(true)
  }, [])

  useEffect(() => {
    setPromptLibrary(loadPromptLibrary(PROMPT_LIBRARY_STORAGE_KEY))
  }, [])

  useEffect(() => {
    const savedPrivacy = localStorage.getItem(PRIVACY_MODE_STORAGE_KEY)
    if (savedPrivacy === '1') setHighPrivacyMode(true)
    const saved = sessionStorage.getItem(API_KEY_SESSION_STORAGE_KEY)
    const normalizedSaved = saved ? normalizeApiKeyInput(saved) : ''
    if (normalizedSaved && isAscii(normalizedSaved)) {
      const pid = normalizeLlmProviderId(sessionStorage.getItem(LLM_PROVIDER_SESSION_KEY))
      const custom = (sessionStorage.getItem(LLM_CUSTOM_BASE_SESSION_KEY) || '').trim()
      {
        const storedMode = sessionStorage.getItem(APP_MODE_SESSION_KEY)
        if (storedMode === 'chat' || storedMode === 'redteam') {
          setAppMode(storedMode)
        } else {
          /* Legacy session: key saved before app mode existed → Red Team */
          setAppMode('redteam')
        }
      }
      setLlmProviderId(pid)
      setLlmCustomBase(custom)
      setApiKey(normalizedSaved)
      setKeySaved(true)
      void loadModels(normalizedSaved, pid, custom)
    } else if (saved) {
      sessionStorage.removeItem(API_KEY_SESSION_STORAGE_KEY)
      sessionStorage.removeItem(LLM_PROVIDER_SESSION_KEY)
      sessionStorage.removeItem(LLM_CUSTOM_BASE_SESSION_KEY)
      sessionStorage.removeItem(APP_MODE_SESSION_KEY)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, highPrivacyMode ? '1' : '0')
    } catch {
      /* ignore storage failures */
    }
  }, [highPrivacyMode])

  useEffect(() => {
    try {
      localStorage.setItem(PROMPT_LIBRARY_STORAGE_KEY, JSON.stringify(promptLibrary))
    } catch {
      /* ignore storage failures */
    }
  }, [promptLibrary])

  useEffect(() => {
    if (!prompt.trim()) {
      // If user cleared the prompt, reset derived metadata so next prompt can auto-generate fresh values.
      setSelectedTemplateId('')
      setTemplateName('')
      setTemplateTagsInput('')
      setTemplateNameTouched(false)
      setTemplateTagsTouched(false)
      setRunLabel('')
      setRunLabelTouched(false)
    }
  }, [prompt])

  useEffect(() => {
    if (!prompt.trim() || selectedTemplateId) return
    const suggested = suggestTemplateMeta(prompt, promptClassify)
    if (!templateNameTouched && !templateName.trim()) {
      setTemplateName(suggested.name)
    }
    if (!templateTagsTouched && !templateTagsInput.trim()) {
      setTemplateTagsInput(suggested.tags.map(t => `#${t.replace(/^#+/, '')}`).join(', '))
    }
  }, [
    prompt,
    promptClassify,
    selectedTemplateId,
    templateNameTouched,
    templateTagsTouched,
    templateName,
    templateTagsInput,
  ])

  useEffect(() => {
    if (!prompt.trim()) {
      if (!runLabelTouched) setRunLabel('')
      return
    }
    if (runLabelTouched) return
    setRunLabel(autoRunLabel(prompt, templateName))
  }, [prompt, templateName, runLabelTouched])

  useEffect(() => {
    try {
      if (!keySaved || !apiKey || highPrivacyMode) {
        sessionStorage.removeItem(API_KEY_SESSION_STORAGE_KEY)
        sessionStorage.removeItem(LLM_PROVIDER_SESSION_KEY)
        sessionStorage.removeItem(LLM_CUSTOM_BASE_SESSION_KEY)
        sessionStorage.removeItem(APP_MODE_SESSION_KEY)
      } else {
        sessionStorage.setItem(API_KEY_SESSION_STORAGE_KEY, apiKey)
        const pid = normalizeLlmProviderId(llmProviderId)
        sessionStorage.setItem(LLM_PROVIDER_SESSION_KEY, pid)
        sessionStorage.setItem(APP_MODE_SESSION_KEY, appMode)
        if (pid === 'custom' && llmCustomBase.trim()) {
          sessionStorage.setItem(LLM_CUSTOM_BASE_SESSION_KEY, llmCustomBase.trim().replace(/\/$/, ''))
        } else {
          sessionStorage.removeItem(LLM_CUSTOM_BASE_SESSION_KEY)
        }
      }
    } catch {
      /* ignore storage failures */
    }
  }, [keySaved, apiKey, highPrivacyMode, llmProviderId, llmCustomBase, appMode])

  useEffect(() => {
    if (!sessionHydrated || !keySaved) return
    try {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          prompt,
          results,
          temperature,
          selectedModelIds: Array.from(selectedModels),
          updatedAt: new Date().toISOString(),
        })
      )
    } catch {
      /* quota or private mode */
    }
  }, [sessionHydrated, keySaved, prompt, results, temperature, selectedModels])

  const modelProviderOptions = useMemo(() => {
    const set = new Set<string>()
    for (const m of models) set.add(modelProviderId(m))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [models])

  useEffect(() => {
    if (modelProviderFilter !== 'all' && !modelProviderOptions.includes(modelProviderFilter)) {
      setModelProviderFilter('all')
    }
  }, [modelProviderFilter, modelProviderOptions])

  const catalogForPriceTierLabels = useMemo(
    () =>
      applyStructuredModelFilters(models, {
        provider: modelProviderFilter,
        monetization: modelMonetizationFilter,
        priceBand: 'all',
        scaleBand: modelScaleBandFilter,
      }),
    [models, modelProviderFilter, modelMonetizationFilter, modelScaleBandFilter]
  )

  const priceTertileLabels = useMemo(
    () => computeOutputPriceTertileLabels(catalogForPriceTierLabels),
    [catalogForPriceTierLabels]
  )

  const filteredModels = useMemo(() => {
    const narrowed = applyStructuredModelFilters(models, {
      provider: modelProviderFilter,
      monetization: modelMonetizationFilter,
      priceBand: modelPriceBandFilter,
      scaleBand: modelScaleBandFilter,
    })
    return filterAndSortModels(narrowed, modelFilter)
  }, [
    models,
    modelFilter,
    modelProviderFilter,
    modelMonetizationFilter,
    modelPriceBandFilter,
    modelScaleBandFilter,
  ])

  /** Red Team grid: show bundled local demo model when no key (same bot as Chat preview). */
  const runSetupDisplayModels = useMemo(() => {
    if (keySaved) return filteredModels
    const rest = filteredModels.filter(m => m.id !== GUEST_DEMO_MODEL_ID)
    return [GUEST_DEMO_MODEL, ...rest]
  }, [keySaved, filteredModels])

  const mutationModelOptions = useMemo(
    () => sortModelsByPopularity(models).map(m => ({ id: m.id, name: m.name || m.id })),
    [models]
  )

  const pickerModels = useMemo(() => {
    if (keySaved) return models
    const rest = models.filter(m => m.id !== GUEST_DEMO_MODEL_ID)
    return [GUEST_DEMO_MODEL, ...rest]
  }, [keySaved, models])

  const [keyGateFocusNonce, setKeyGateFocusNonce] = useState(0)

  useEffect(() => {
    if (keySaved) return
    if (appMode !== 'chat' && appMode !== 'redteam') return
    if (models.length > 0) return
    let cancelled = false
    setModelsLoading(true)
    void fetchOpenRouterModelsPublic().then(res => {
      if (cancelled) return
      if (res.ok) setModels(res.models)
      else setModels([])
      setModelsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [keySaved, appMode, models.length])

  useEffect(() => {
    if (keySaved) return
    setGroupChatModelIds([GUEST_DEMO_MODEL_ID])
  }, [keySaved])

  useEffect(() => {
    if (!keySaved) return
    setGroupChatModelIds(prev => prev.filter(id => id !== GUEST_DEMO_MODEL_ID))
  }, [keySaved])

  useEffect(() => {
    if (keySaved) return
    if (groupChatModelIds.length > 0) return
    setGroupChatModelIds([GUEST_DEMO_MODEL_ID])
  }, [keySaved, groupChatModelIds.length])

  useEffect(() => {
    if (models.length === 0) return
    setSelectedModels(prev => {
      const valid = new Set(models.map(m => m.id))
      const next = new Set<string>()
      for (const id of prev) {
        if (valid.has(id)) next.add(id)
        else if (!keySaved && id === GUEST_DEMO_MODEL_ID) next.add(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [models, keySaved])

  useEffect(() => {
    if (keySaved) return
    if (selectedModels.size > 0) return
    setSelectedModels(new Set([GUEST_DEMO_MODEL_ID]))
  }, [keySaved, selectedModels.size])

  useEffect(() => {
    if (!keySaved) return
    setSelectedModels(prev => {
      if (!prev.has(GUEST_DEMO_MODEL_ID)) return prev
      const next = new Set(prev)
      next.delete(GUEST_DEMO_MODEL_ID)
      return next
    })
  }, [keySaved])

  useEffect(() => {
    if (!keySaved) return
    if (classifyDebounce.current) {
      clearTimeout(classifyDebounce.current)
      classifyDebounce.current = null
    }
    if (!prompt.trim()) {
      setPromptClassify(null)
      setClassifyLoading(false)
      setClassifyUnavailable(false)
      return
    }
    setClassifyLoading(true)
    setClassifyUnavailable(false)
    const thisRequest = ++classifyRequestId.current
    classifyDebounce.current = setTimeout(() => {
      const result = classifyPromptLocal(prompt)
      if (thisRequest !== classifyRequestId.current) return
      setPromptClassify(result)
      setClassifyLoading(false)
    }, 400)
    return () => {
      if (classifyDebounce.current) {
        clearTimeout(classifyDebounce.current)
        classifyDebounce.current = null
      }
    }
  }, [prompt, keySaved])

  useEffect(() => {
    if (!loading) return
    const timerId = window.setInterval(() => setProgressNow(Date.now()), 1000)
    return () => window.clearInterval(timerId)
  }, [loading])

  useEffect(() => {
    if (!ANALYTICS_BEACON_URL) return
    const payload = {
      event: 'visit',
      ts: new Date().toISOString(),
      path: typeof window !== 'undefined' ? window.location.pathname : '/',
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
      lang: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
    }
    void fetch(ANALYTICS_BEACON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* ignore analytics failures */
    })
  }, [])

  useEffect(() => {
    const field = cometBackdropRef.current
    if (!field) return
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const rand = (min: number, max: number) => Math.random() * (max - min) + min
    let timerId: number | null = null
    let stopped = false

    const spawnComet = () => {
      if (!field || stopped) return
      const comet = document.createElement('div')
      comet.className = 'comet'
      if (Math.random() > 0.82) comet.classList.add('flare')

      const layer = Math.random()
      let duration = 2
      let length = 60
      let opacity = 0.6
      if (layer < 0.33) {
        duration = rand(6.2, 10.4)
        length = rand(20, 50)
        opacity = rand(0.28, 0.46)
      } else if (layer < 0.66) {
        duration = rand(4.8, 8.5)
        length = rand(40, 90)
        opacity = rand(0.36, 0.58)
      } else {
        duration = rand(3.4, 6.5)
        length = rand(70, 140)
        opacity = rand(0.52, 0.8)
      }

      const w = window.innerWidth
      const h = window.innerHeight
      const diagonal = Math.hypot(w, h)

      // Positive angle: trajectory down-right across the viewport.
      const angle = rand(22, 42)
      const startX = rand(-w * 0.35, w * 1.35)
      const startY = rand(-h * 0.25, h * 1.05)
      const distance = rand(diagonal * 0.65, diagonal * 1.35)
      const rad = (angle * Math.PI) / 180
      const travelX = distance * Math.cos(rad)
      const travelY = distance * Math.sin(rad)

      comet.style.left = `${startX}px`
      comet.style.top = `${startY}px`
      comet.style.setProperty('--length', `${length}px`)
      comet.style.setProperty('--duration', `${duration}s`)
      comet.style.setProperty('--angle', `${angle}deg`)
      comet.style.setProperty('--travel-x', `${travelX}px`)
      comet.style.setProperty('--travel-y', `${travelY}px`)
      comet.style.setProperty('--opacity', String(opacity))
      field.appendChild(comet)
      comet.addEventListener('animationend', () => comet.remove(), { once: true })
    }

    const loop = () => {
      if (stopped) return
      spawnComet()
      timerId = window.setTimeout(loop, rand(300, 760))
    }

    loop()
    return () => {
      stopped = true
      if (timerId !== null) window.clearTimeout(timerId)
      field.querySelectorAll('.comet').forEach(el => el.remove())
    }
  }, [])

  useEffect(() => {
    if (!keySaved) return
    /* Local dev: avoid losing the key during long pauses (reading docs, breakpoints, etc.). Production/preview still uses idle timeout. */
    if (import.meta.env.DEV) return
    let idleTimer: number | null = null
    const resetIdle = () => {
      if (idleTimer !== null) window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        clearKey()
        setErrorMsg('Session expired for privacy (30m idle). Please paste key again.')
      }, KEY_IDLE_CLEAR_MS)
    }
    resetIdle()
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'mousemove', 'scroll', 'touchstart']
    for (const ev of events) window.addEventListener(ev, resetIdle, { passive: true })
    return () => {
      if (idleTimer !== null) window.clearTimeout(idleTimer)
      for (const ev of events) window.removeEventListener(ev, resetIdle)
    }
  }, [keySaved])

  const { passCount, blockCount, errorCount, unknownCount } = useMemo(() => {
    let pass = 0
    let fail = 0
    let failStory = 0
    let err = 0
    let unknown = 0
    for (const r of results) {
      switch (r.status) {
        case 'pass':
          pass += 1
          break
        case 'fail':
          fail += 1
          break
        case 'fail_story':
          failStory += 1
          break
        case 'error':
          err += 1
          break
        default:
          unknown += 1
      }
    }
    return {
      passCount: pass,
      blockCount: fail + failStory,
      errorCount: err,
      unknownCount: unknown,
    }
  }, [results])

  const copyText = async (text: string, key: string) => {
    const value = text ?? ''
    if (!value.trim()) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const ta = document.createElement('textarea')
        ta.value = value
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiedKey(key)
      if (copiedKeyTimerRef.current !== null) window.clearTimeout(copiedKeyTimerRef.current)
      copiedKeyTimerRef.current = window.setTimeout(() => {
        copiedKeyTimerRef.current = null
        setCopiedKey(prev => (prev === key ? null : prev))
      }, 1200)
    } catch {
      setErrorMsg('Copy failed. Please copy manually.')
    }
  }

  const openContinueChat = (result: TestResult) => {
    if (result.error || !result.response.trim()) return
    setActiveChatModelId(result.modelId)
    setChatInput('')
    setChatError('')
    setChatHistories(prev => {
      if (prev[result.modelId]?.length) return prev
      const seed: ChatMessage[] = []
      const basePrompt = prompt.trim()
      if (basePrompt) seed.push({ role: 'user', content: basePrompt, ts: Date.now() })
      const baseAnswer = result.response.trim()
      if (baseAnswer) seed.push({ role: 'assistant', content: baseAnswer, ts: Date.now() + 1 })
      return { ...prev, [result.modelId]: seed }
    })
  }

  const closeContinueChat = () => {
    setActiveChatModelId(null)
    setChatInput('')
    setChatError('')
  }

  const getLatestResultForModel = (modelId: string): TestResult | null => {
    for (let i = results.length - 1; i >= 0; i -= 1) {
      if (results[i].modelId === modelId) return results[i]
    }
    return null
  }

  const sendContinueChat = async () => {
    const modelId = activeChatModelId
    const message = chatInput.trim()
    if (!modelId || !message || chatLoading) return

    const modelName = getLatestResultForModel(modelId)?.modelName || modelId
    const userMsg: ChatMessage = { role: 'user', content: message, ts: Date.now() }
    const historyBefore = chatHistories[modelId] ?? []
    const nextHistory = [...historyBefore, userMsg]

    setChatHistories(prev => ({ ...prev, [modelId]: nextHistory }))
    setChatInput('')
    setChatError('')
    setChatLoading(true)

    try {
      const pid = normalizeLlmProviderId(llmProviderId)
      const chatModel = models.find(m => m.id === modelId)
      const result = await postLlmChatCompletion({
        apiKey,
        model: modelId,
        messages: nextHistory.map(m => ({ role: m.role, content: m.content })),
        temperature,
        providerId: pid,
        customApiBase:
          pid === 'custom' && llmCustomBase.trim() ? llmCustomBase.trim().replace(/\/$/, '') : undefined,
        outputModalities: chatModel?.outputModalities,
      })

      if (!result.raw && !result.ok) {
        setChatError(`HTTP ${result.status} (empty response)`)
        return
      }

      if (!result.ok) {
        const errObj = result.data.error as { message?: string } | undefined
        setChatError(errObj?.message || (result.raw ? result.raw.slice(0, 300) : `HTTP ${result.status}`))
        return
      }

      const choices = result.data.choices as Choice[] | undefined
      let { text } = extractAssistantPayload(choices?.[0])
      if (!text.trim()) text = extractFromImagesApiData(result.data)
      if (!text.trim() && result.raw) text = buildUnrecognizedResponseNote(result.data, result.raw)
      if (isProviderOrUpstreamErrorContent(text)) {
        setChatError(text.trim())
        return
      }
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: text.trim() ? text : '(empty response)',
        ts: Date.now(),
      }
      setChatHistories(prev => ({
        ...prev,
        [modelId]: [...(prev[modelId] ?? []), assistantMsg],
      }))
    } catch (error) {
      setChatError((error as Error).message || `Failed to continue chat with ${modelName}`)
    } finally {
      setChatLoading(false)
    }
  }

  const toggleGroupChatModel = (model: Model) => {
    if (!keySaved) {
      if (model.id === GUEST_DEMO_MODEL_ID) {
        setGroupChatModelIds(prev => {
          const i = prev.indexOf(model.id)
          if (i >= 0) return prev.filter(id => id !== model.id)
          return [...prev, model.id]
        })
        return
      }
      setKeyGateFocusNonce(n => n + 1)
      return
    }
    setGroupChatModelIds(prev => {
      const i = prev.indexOf(model.id)
      if (i >= 0) return prev.filter(id => id !== model.id)
      return [...prev, model.id]
    })
  }

  const exploreAddThreeCheapModels = useCallback(() => {
    if (!keySaved) {
      setKeyGateFocusNonce(n => n + 1)
      return
    }
    const picked = pickExploreCheapModels(models, 3)
    if (picked.length === 0) return
    if (appMode === 'redteam') {
      setSelectedModels(prev => {
        const next = new Set(prev)
        for (const m of picked) next.add(m.id)
        return next
      })
    } else {
      setGroupChatModelIds(prev => {
        const next = [...prev]
        for (const m of picked) {
          if (!next.includes(m.id)) next.push(m.id)
        }
        return next
      })
    }
  }, [keySaved, models, appMode])

  const removeGroupChatModelId = (modelId: string) => {
    setGroupChatModelIds(prev => prev.filter(id => id !== modelId))
  }

  /** Drop one assistant/provider_error line (any count). Keeps regen spinner index aligned with the new array. */
  const removeGroupChatMessageAt = useCallback((index: number) => {
    setRegeneratingMessageIndex(prevIdx => {
      if (prevIdx === null) return null
      if (prevIdx === index) return null
      if (prevIdx > index) return prevIdx - 1
      return prevIdx
    })
    setGroupChatMessages(prev => {
      if (index < 0 || index >= prev.length) return prev
      const target = prev[index]
      if (!target || (target.role !== 'assistant' && target.role !== 'provider_error')) return prev
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const resetGroupChatUi = useCallback(() => {
    setGroupChatMessages([])
    setGroupChatModelIds([])
    setGroupChatSystemPrompt('')
    setChatInput('')
    setRegeneratingMessageIndex(null)
    setActiveGroupChatSessionId(null)
  }, [])

  const [groupChatHistory, setGroupChatHistory] = useState(() => readGroupChatSessionHistory())

  useEffect(() => {
    writeRunHistory(runHistory)
  }, [runHistory])

  const [keyBalance, setKeyBalance] = useState<ChatKeyBalanceState>({ t: 'idle' })

  const refreshKeyBalance = useCallback(async () => {
    const pid = normalizeLlmProviderId(llmProviderId)
    if (!keySaved || !apiKey || pid !== 'openrouter') {
      setKeyBalance({ t: 'idle' })
      return
    }
    if (balanceErrorCount.current >= 5) return
    setKeyBalance(prev => (prev.t === 'ok' ? prev : { t: 'loading' }))
    const ctx = { providerId: 'openrouter' as const }
    const [creditsRes, keyRes] = await Promise.all([
      fetchOpenRouterCredits(apiKey, ctx),
      fetchOpenRouterKeyInfo(apiKey, ctx),
    ])
    if (!keyRes.ok && !creditsRes.ok) {
      balanceErrorCount.current += 1
      setKeyBalance({ t: 'err', msg: keyRes.detail })
      return
    }
    if (!keyRes.ok && creditsRes.ok) {
      const c = creditsRes.info
      setKeyBalance({
        t: 'ok',
        remaining: c.remaining,
        limit: null,
        usage: 0,
        balanceSource: 'account',
        accountTotalCredits: c.totalCredits,
        accountTotalUsage: c.totalUsage,
      })
      return
    }
    if (!keyRes.ok) return
    const key = keyRes.info
    if (creditsRes.ok) {
      const c = creditsRes.info
      setKeyBalance({
        t: 'ok',
        remaining: c.remaining,
        limit: key.limit,
        usage: key.usage,
        balanceSource: 'account',
        accountTotalCredits: c.totalCredits,
        accountTotalUsage: c.totalUsage,
        keyLimitRemaining: key.limitRemaining,
      })
    } else {
      setKeyBalance({
        t: 'ok',
        remaining: key.limitRemaining,
        limit: key.limit,
        usage: key.usage,
        balanceSource: 'key',
      })
    }
  }, [keySaved, apiKey, llmProviderId])

  useEffect(() => {
    const pid = normalizeLlmProviderId(llmProviderId)
    if (!keySaved || !apiKey || pid !== 'openrouter') {
      setKeyBalance({ t: 'idle' })
      return
    }
    balanceErrorCount.current = 0
    void refreshKeyBalance()
  }, [keySaved, apiKey, llmProviderId, refreshKeyBalance])

  useEffect(() => {
    const pid = normalizeLlmProviderId(llmProviderId)
    if (!keySaved || !apiKey || pid !== 'openrouter') return
    const id = window.setInterval(() => void refreshKeyBalance(), 30_000)
    return () => window.clearInterval(id)
  }, [keySaved, apiKey, llmProviderId, refreshKeyBalance])

  const refreshGroupChatHistory = useCallback(() => {
    setGroupChatHistory(readGroupChatSessionHistory())
  }, [])

  const closeGroupChatWithArchive = useCallback(() => {
    const next = appendGroupChatSessionSnapshot({
      modelIds: groupChatModelIds,
      systemPrompt: groupChatSystemPrompt,
      messages: groupChatMessages,
      composerDraft: chatInput,
      existingSessionId: activeGroupChatSessionId,
    })
    setGroupChatHistory(next)
    resetGroupChatUi()
  }, [
    groupChatModelIds,
    groupChatSystemPrompt,
    groupChatMessages,
    chatInput,
    activeGroupChatSessionId,
    resetGroupChatUi,
  ])

  const restoreGroupChatFromHistory = useCallback((id: string) => {
    const entries = readGroupChatSessionHistory()
    const s = entries.find(e => e.id === id)
    if (!s) return
    setActiveGroupChatSessionId(id)
    setGroupChatMessages(s.messages.map(m => ({ ...m })))
    setGroupChatModelIds([...s.modelIds])
    setGroupChatSystemPrompt(s.systemPrompt)
    setChatInput(s.composerDraft)
    setRegeneratingMessageIndex(null)
  }, [])

  const removeGroupChatHistoryEntry = useCallback((id: string) => {
    setGroupChatHistory(removeGroupChatSessionFromHistory(id))
  }, [])

  /**
   * `rollingWithUser` must end with the latest user message. Appends one assistant (demo) or
   * one line per selected model (live).
   */
  const appendAssistantResponsesAfterUser = useCallback(
    async (rollingWithUser: GroupChatMessage[], systemForApi: string) => {
      const last = rollingWithUser[rollingWithUser.length - 1]
      if (!last || last.role !== 'user' || !last.content.trim()) return

      if (!keySaved) {
        const nUsers = rollingWithUser.filter(m => m.role === 'user').length
        if (groupChatModelIds.length === 0) return
        setGroupChatLoading(true)
        try {
          await new Promise<void>(resolve => {
            window.setTimeout(resolve, 280)
          })
          const turnIdx = nUsers - 1
          const assistantMsg: GroupChatMessage = {
            role: 'assistant',
            content: guestDemoAssistantReply(turnIdx, last.content),
            ts: Date.now(),
            authorModelId: GUEST_DEMO_MODEL_ID,
            authorModelName: GUEST_DEMO_MODEL.name,
          }
          setGroupChatMessages([...rollingWithUser, assistantMsg])
        } finally {
          setGroupChatLoading(false)
        }
        return
      }

      const autoFreeOpenRouter = keySaved && groupChatModelIds.length === 0
      const resolvedModelIds: string[] = autoFreeOpenRouter
        ? (() => {
            const picked = pickListedFreeOpenRouterModel(models)
            return picked ? [picked.id] : []
          })()
        : [...groupChatModelIds]

      if (resolvedModelIds.length === 0) {
        setErrorMsg(
          autoFreeOpenRouter
            ? 'No listed-free OpenRouter models in the catalog yet. Pick a model below or wait for the list to load.'
            : 'Select at least one model.',
        )
        return
      }

      setGroupChatLoading(true)
      let rolling: GroupChatMessage[] = [...rollingWithUser]
      const pid = normalizeLlmProviderId(llmProviderId)
      const customApiBase =
        pid === 'custom' && llmCustomBase.trim() ? llmCustomBase.trim().replace(/\/$/, '') : undefined

      let lastTriedModelId = resolvedModelIds[0] ?? ''

      try {
        for (let mi = 0; mi < resolvedModelIds.length; mi++) {
          const modelId = resolvedModelIds[mi]!
          /*
            After the first model, pick up any deletions the user made to the live transcript
            (e.g. they deleted an immediate error before the next model ran), but keep all
            messages we added in previous iterations even if the ref hasn't re-synced yet.
            Using ref directly without this merge causes data loss: React state updates are
            async so the ref may lag, and a naive replace drops messages from prior iterations.
          */
          if (mi > 0) {
            const refCurrent = groupChatMessagesRef.current
            const refTsSet = new Set(refCurrent.map(m => m.ts))
            // Messages we added in previous iterations that the ref hasn't caught up to yet
            const unsyncedFromLoop = rolling.filter(m => !refTsSet.has(m.ts))
            rolling = [...refCurrent, ...unsyncedFromLoop]
          }
          lastTriedModelId = modelId
          const gcModel = models.find(m => m.id === modelId)
          const modelName = gcModel?.name || modelId
          const authorLabel = autoFreeOpenRouter ? 'Free Open Router' : modelName
          const gcMods = gcModel?.outputModalities
          const isMedia = gcMods != null && (gcMods.includes('image') || gcMods.includes('video') || gcMods.includes('audio'))
          const apiMessages = buildGroupChatApiMessages(systemForApi, rolling, { mediaModel: isMedia })

          const result = await postLlmChatCompletion({
            apiKey,
            model: modelId,
            messages: apiMessages,
            temperature,
            providerId: pid,
            customApiBase,
            outputModalities: gcMods,
          })

          if (!result.raw && !result.ok) {
            const errLine: GroupChatMessage = {
              role: 'provider_error',
              content: `HTTP ${result.status} (empty response)`,
              ts: Date.now(),
              authorModelId: modelId,
              authorModelName: authorLabel,
              ...(autoFreeOpenRouter ? { authorViaFreeOpenRouter: true } : {}),
            }
            rolling = [...rolling, errLine]
            setGroupChatMessages(rolling)
            continue
          }
          if (!result.ok) {
            const errObj = result.data.error as { message?: string } | undefined
            const errLine: GroupChatMessage = {
              role: 'provider_error',
              content:
                errObj?.message || (result.raw ? result.raw.slice(0, 300) : `HTTP ${result.status}`),
              ts: Date.now(),
              authorModelId: modelId,
              authorModelName: authorLabel,
              ...(autoFreeOpenRouter ? { authorViaFreeOpenRouter: true } : {}),
            }
            rolling = [...rolling, errLine]
            setGroupChatMessages(rolling)
            continue
          }

          const choices = result.data.choices as Choice[] | undefined
          let { text } = extractAssistantPayload(choices?.[0])
          if (!text.trim()) text = extractFromImagesApiData(result.data)
          if (!text.trim() && result.raw) text = buildUnrecognizedResponseNote(result.data, result.raw)
          if (isProviderOrUpstreamErrorContent(text)) {
            const errLine: GroupChatMessage = {
              role: 'provider_error',
              content: text.trim(),
              ts: Date.now(),
              authorModelId: modelId,
              authorModelName: authorLabel,
              ...(autoFreeOpenRouter ? { authorViaFreeOpenRouter: true } : {}),
            }
            rolling = [...rolling, errLine]
            setGroupChatMessages(rolling)
            continue
          }
          const assistantMsg: GroupChatMessage = {
            role: 'assistant',
            content: text.trim() ? text : '(empty response)',
            ts: Date.now(),
            authorModelId: modelId,
            authorModelName: authorLabel,
            ...(autoFreeOpenRouter ? { authorViaFreeOpenRouter: true } : {}),
          }
          rolling = [...rolling, assistantMsg]
          setGroupChatMessages(rolling)
        }
      } catch (error) {
        const failName = models.find(m => m.id === lastTriedModelId)?.name || lastTriedModelId
        const errLine: GroupChatMessage = {
          role: 'provider_error',
          content: (error as Error).message || 'Group chat request failed',
          ts: Date.now(),
          authorModelId: lastTriedModelId,
          authorModelName: autoFreeOpenRouter ? 'Free Open Router' : failName,
          ...(autoFreeOpenRouter ? { authorViaFreeOpenRouter: true } : {}),
        }
        setGroupChatMessages(prev => [...prev, errLine])
      } finally {
        setGroupChatLoading(false)
      }
    },
    [
      keySaved,
      groupChatModelIds,
      models,
      apiKey,
      temperature,
      llmProviderId,
      llmCustomBase,
    ],
  )

  const submitEditedUserMessage = useCallback(
    async (messageIndex: number, newContent: string) => {
      if (groupChatLoading || regeneratingMessageIndex !== null) return
      const trimmed = newContent.trim()
      if (!trimmed) return
      const prev = groupChatMessagesRef.current
      if (messageIndex < 0 || messageIndex >= prev.length) return
      if (prev[messageIndex].role !== 'user') return

      if (!keySaved) {
        if (groupChatModelIds.length === 0) return
      } else {
        const autoFreeOpenRouter = groupChatModelIds.length === 0
        const resolvedModelIds: string[] = autoFreeOpenRouter
          ? (() => {
              const picked = pickListedFreeOpenRouterModel(models)
              return picked ? [picked.id] : []
            })()
          : [...groupChatModelIds]
        if (resolvedModelIds.length === 0) {
          setErrorMsg(
            autoFreeOpenRouter
              ? 'No listed-free OpenRouter models in the catalog yet. Pick a model below or wait for the list to load.'
              : 'Select at least one model.',
          )
          return
        }
      }

      const head = prev.slice(0, messageIndex)
      const rolling: GroupChatMessage[] = [
        ...head,
        { role: 'user', content: trimmed, ts: Date.now() },
      ]
      setGroupChatMessages(rolling)
      setErrorMsg('')
      await appendAssistantResponsesAfterUser(rolling, groupChatSystemPrompt)
    },
    [
      groupChatLoading,
      regeneratingMessageIndex,
      keySaved,
      groupChatModelIds,
      models,
      groupChatSystemPrompt,
      appendAssistantResponsesAfterUser,
    ],
  )

  const sendGroupChat = async () => {
    const message = chatInput.trim()
    if (!message || groupChatLoading) return

    const userTurnsSoFar = groupChatMessages.filter(m => m.role === 'user').length
    let userContent = message
    let systemForApi = groupChatSystemPrompt
    if (userTurnsSoFar === 0) {
      const split = trySplitFirstComposerPrompt(message)
      if (split) {
        userContent = split.user
        systemForApi = groupChatSystemPrompt.trim()
          ? `${groupChatSystemPrompt.trim()}\n\n${split.system}`
          : split.system
        if (systemForApi !== groupChatSystemPrompt) {
          setGroupChatSystemPrompt(systemForApi)
        }
      }
    }

    if (!keySaved) {
      if (groupChatModelIds.length === 0) return
    } else {
      const autoFreeOpenRouter = groupChatModelIds.length === 0
      const resolvedModelIds: string[] = autoFreeOpenRouter
        ? (() => {
            const picked = pickListedFreeOpenRouterModel(models)
            return picked ? [picked.id] : []
          })()
        : [...groupChatModelIds]
      if (resolvedModelIds.length === 0) {
        setErrorMsg(
          autoFreeOpenRouter
            ? 'No listed-free OpenRouter models in the catalog yet. Pick a model below or wait for the list to load.'
            : 'Select at least one model.',
        )
        return
      }
    }

    const userMsg: GroupChatMessage = { role: 'user', content: userContent, ts: Date.now() }
    const rolling: GroupChatMessage[] = [...groupChatMessages, userMsg]
    setGroupChatMessages(rolling)
    setChatInput('')

    await appendAssistantResponsesAfterUser(rolling, systemForApi)
  }

  const regenerateGroupChatLine = useCallback(
    async (messageIndex: number) => {
      if (!keySaved || groupChatLoading || regeneratingMessageIndex !== null) return
      const prev = groupChatMessagesRef.current
      const target = prev[messageIndex]
      if (!target || (target.role !== 'assistant' && target.role !== 'provider_error')) return
      const modelId = (target.authorModelId || '').trim()
      if (!modelId || modelId === GUEST_DEMO_MODEL_ID) return

      const prefix = prev.slice(0, messageIndex)
      const regenModel = models.find(m => m.id === modelId)
      const modelName = regenModel?.name || modelId
      const authorLabel = target.authorViaFreeOpenRouter ? 'Free Open Router' : modelName
      const autoFree = Boolean(target.authorViaFreeOpenRouter)

      setRegeneratingMessageIndex(messageIndex)
      setErrorMsg('')

      const pid = normalizeLlmProviderId(llmProviderId)
      const customApiBase =
        pid === 'custom' && llmCustomBase.trim() ? llmCustomBase.trim().replace(/\/$/, '') : undefined

      const applyReplacement = (line: GroupChatMessage) => {
        setGroupChatMessages(curr => {
          if (messageIndex >= curr.length) return curr
          const existing = curr[messageIndex]
          if (
            !existing ||
            (existing.role !== 'assistant' && existing.role !== 'provider_error') ||
            (existing.authorModelId || '').trim() !== modelId
          ) {
            return curr
          }
          const next = [...curr]
          next[messageIndex] = { ...line, ts: Date.now() }
          return next
        })
      }

      try {
        const regenMods = regenModel?.outputModalities
        const isMedia = regenMods != null && (regenMods.includes('image') || regenMods.includes('video') || regenMods.includes('audio'))
        const apiMessages = buildGroupChatApiMessages(groupChatSystemPrompt, prefix, { mediaModel: isMedia })
        const result = await postLlmChatCompletion({
          apiKey,
          model: modelId,
          messages: apiMessages,
          temperature,
          providerId: pid,
          customApiBase,
          outputModalities: regenMods,
        })

        if (!result.raw && !result.ok) {
          applyReplacement({
            role: 'provider_error',
            content: `HTTP ${result.status} (empty response)`,
            ts: Date.now(),
            authorModelId: modelId,
            authorModelName: authorLabel,
            ...(autoFree ? { authorViaFreeOpenRouter: true } : {}),
          })
          return
        }
        if (!result.ok) {
          const errObj = result.data.error as { message?: string } | undefined
          applyReplacement({
            role: 'provider_error',
            content:
              errObj?.message || (result.raw ? result.raw.slice(0, 300) : `HTTP ${result.status}`),
            ts: Date.now(),
            authorModelId: modelId,
            authorModelName: authorLabel,
            ...(autoFree ? { authorViaFreeOpenRouter: true } : {}),
          })
          return
        }

        const choices = result.data.choices as Choice[] | undefined
        let { text } = extractAssistantPayload(choices?.[0])
        if (!text.trim()) text = extractFromImagesApiData(result.data)
        if (!text.trim() && result.raw) text = buildUnrecognizedResponseNote(result.data, result.raw)
        if (isProviderOrUpstreamErrorContent(text)) {
          applyReplacement({
            role: 'provider_error',
            content: text.trim(),
            ts: Date.now(),
            authorModelId: modelId,
            authorModelName: authorLabel,
            ...(autoFree ? { authorViaFreeOpenRouter: true } : {}),
          })
          return
        }
        applyReplacement({
          role: 'assistant',
          content: text.trim() ? text : '(empty response)',
          ts: Date.now(),
          authorModelId: modelId,
          authorModelName: authorLabel,
          ...(autoFree ? { authorViaFreeOpenRouter: true } : {}),
        })
      } catch (error) {
        applyReplacement({
          role: 'provider_error',
          content: (error as Error).message || 'Regenerate failed',
          ts: Date.now(),
          authorModelId: modelId,
          authorModelName: authorLabel,
          ...(autoFree ? { authorViaFreeOpenRouter: true } : {}),
        })
      } finally {
        setRegeneratingMessageIndex(null)
      }
    },
    [
      apiKey,
      groupChatLoading,
      groupChatSystemPrompt,
      keySaved,
      llmCustomBase,
      llmProviderId,
      models,
      regeneratingMessageIndex,
      temperature,
    ],
  )

  const handleSaveKey = async () => {
    const normalizedKey = normalizeApiKeyInput(keyInput)
    if (!normalizedKey) {
      setErrorMsg('Please enter an API key')
      return
    }
    if (!isAscii(normalizedKey)) {
      setErrorMsg(
        'API key contains non-ASCII characters. Please paste the key again in English layout (ASCII only).'
      )
      return
    }
    const pid = normalizeLlmProviderId(llmProviderId)
    const customTrim = llmCustomBase.trim().replace(/\/$/, '')
    if (pid === 'custom') {
      if (!customTrim) {
        setErrorMsg('Enter a same-origin API base path (for example /my-proxy/v1).')
        return
      }
      if (!customTrim.startsWith('/')) {
        setErrorMsg('Custom API path must start with / (same-origin relative path).')
        return
      }
    }
    setErrorMsg('')
    setModelsLoading(true)

    try {
      const result = await fetchLlmModels(normalizedKey, {
        providerId: pid,
        customApiBase: pid === 'custom' ? customTrim : undefined,
      })
      if (!result.ok) {
        setErrorMsg(`Key verification failed (${result.status}): ${result.detail}`)
        return
      }

      if (!highPrivacyMode) {
        try {
          sessionStorage.setItem(API_KEY_SESSION_STORAGE_KEY, normalizedKey)
          sessionStorage.setItem(LLM_PROVIDER_SESSION_KEY, pid)
          sessionStorage.setItem(APP_MODE_SESSION_KEY, appMode)
          if (pid === 'custom') {
            sessionStorage.setItem(LLM_CUSTOM_BASE_SESSION_KEY, customTrim)
          } else {
            sessionStorage.removeItem(LLM_CUSTOM_BASE_SESSION_KEY)
          }
        } catch {
          /* ignore storage failures */
        }
      }
      setLlmProviderId(pid)
      setLlmCustomBase(pid === 'custom' ? customTrim : '')
      setApiKey(normalizedKey)
      setKeySaved(true)
      setKeyInput('')
      setModels(result.models)
    } catch (error) {
      const msg = (error as Error).message
      setErrorMsg(
        `Network error: ${msg}. Use \`npm run dev\` or \`npm run preview\` (not opening dist HTML as a file). If this persists, check firewall/VPN; static deploys must proxy the same-origin paths your provider uses (e.g. /openrouter-api, /llm-openai, /llm-groq, or your custom path).`
      )
    } finally {
      setModelsLoading(false)
    }
  }

  const loadModels = async (key: string, providerOverride?: string, customOverride?: string) => {
    const providerId =
      providerOverride !== undefined ? normalizeLlmProviderId(providerOverride) : normalizeLlmProviderId(llmProviderId)
    const customRaw = customOverride !== undefined ? customOverride : llmCustomBase
    const customApiBase =
      providerId === 'custom' && customRaw.trim()
        ? customRaw.trim().replace(/\/$/, '')
        : undefined

    setModelsLoading(true)
    setErrorMsg('')
    try {
      const result = await fetchLlmModels(key, { providerId, customApiBase })
      if (!result.ok) {
        setErrorMsg(`Failed to load models (${result.status}): ${result.detail}`)
        return
      }
      setModels(result.models)
    } catch (error) {
      setErrorMsg(`Network error loading models: ${(error as Error).message}`)
    } finally {
      setModelsLoading(false)
    }
  }

  const clearKey = () => {
    sessionStorage.removeItem(API_KEY_SESSION_STORAGE_KEY)
    sessionStorage.removeItem(LLM_PROVIDER_SESSION_KEY)
    sessionStorage.removeItem(LLM_CUSTOM_BASE_SESSION_KEY)
    sessionStorage.removeItem(APP_MODE_SESSION_KEY)
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setKeyGateFocusNonce(0)
    setApiKey('')
    setKeyBalance({ t: 'idle' })
    setLlmProviderId('openrouter')
    setLlmCustomBase('')
    setAppMode('chat')
    setKeySaved(false)
    setModels([])
    setModelProviderFilter('all')
    setModelMonetizationFilter('all')
    setModelPriceBandFilter('all')
    setModelScaleBandFilter('all')
    setSelectedModels(new Set())
    setPrompt('')
    setResults([])
    setRunHistory([])
    sessionStorage.removeItem(RUN_HISTORY_SESSION_KEY)
    setTemperature(DEFAULT_TEMPERATURE)
  }

  const clearResults = () => {
    setResults([])
  }

  const removeResultAt = (index: number) => {
    setResults(prev => prev.filter((_, i) => i !== index))
  }

  const toggleModel = (modelId: string) => {
    if (!keySaved) {
      if (modelId === GUEST_DEMO_MODEL_ID) {
        const newSelected = new Set(selectedModels)
        if (newSelected.has(modelId)) newSelected.delete(modelId)
        else newSelected.add(modelId)
        setSelectedModels(newSelected)
        return
      }
      setKeyGateFocusNonce(n => n + 1)
      return
    }
    const newSelected = new Set(selectedModels)
    if (newSelected.has(modelId)) newSelected.delete(modelId)
    else newSelected.add(modelId)
    setSelectedModels(newSelected)
  }

  const selectAllFiltered = () => {
    if (!keySaved) {
      setKeyGateFocusNonce(n => n + 1)
      return
    }
    setSelectedModels(new Set(filteredModels.map(m => m.id)))
  }

  const clearSelection = () => setSelectedModels(new Set())

  const savePromptTemplate = () => {
    const rawName = templateName.trim()
    const name = /\b(?:version\s*\d+|v\d+)\b/i.test(rawName) ? rawName : `${rawName} - V1`
    const body = prompt.trim()
    if (!name || !body) {
      setErrorMsg('Template name and prompt are required')
      return
    }
    const tags = parseTags(templateTagsInput)
    const existing = promptLibrary.find(t => t.name.toLowerCase() === name.toLowerCase())
    const next: PromptTemplate = {
      id: existing?.id || generateRunId(),
      name,
      prompt: body,
      tags,
      updatedAt: new Date().toISOString(),
    }
    setPromptLibrary(prev => {
      const rest = prev.filter(t => t.id !== next.id)
      return [next, ...rest].slice(0, 200)
    })
    setSelectedTemplateId(next.id)
    setTemplateNameTouched(true)
    setTemplateTagsTouched(true)
    setErrorMsg('')
  }

  const loadTemplateIntoPrompt = (id: string) => {
    setSelectedTemplateId(id)
    const t = promptLibrary.find(x => x.id === id)
    if (!t) return
    setTemplateName(t.name)
    setTemplateTagsInput(t.tags.map(tag => `#${tag.replace(/^#+/, '')}`).join(', '))
    setTemplateNameTouched(true)
    setTemplateTagsTouched(true)
    setPrompt(t.prompt)
  }

  const deleteTemplate = () => {
    if (!selectedTemplateId) return
    setPromptLibrary(prev => prev.filter(t => t.id !== selectedTemplateId))
    setSelectedTemplateId('')
    setTemplateNameTouched(false)
    setTemplateTagsTouched(false)
  }

  const handleRunTests = async () => {
    if (!prompt.trim()) {
      setErrorMsg('Please enter a prompt')
      return
    }
    if (selectedModels.size === 0) {
      setErrorMsg('Please select at least one model')
      return
    }

    if (runAbortRef.current) {
      runAbortRef.current.abort()
    }
    const runAbortController = new AbortController()
    runAbortRef.current = runAbortController

    setErrorMsg('')
    setLoading(true)
    setResults([])
    setLastResultAt(null)
    setProgressNow(Date.now())
    const currentRunId = generateRunId()
    currentRunIdRef.current = currentRunId
    const effectiveRunLabel = runLabel.trim() || `run-${new Date().toLocaleTimeString()}`

    const selectedModelArray = Array.from(selectedModels)

    const pid = normalizeLlmProviderId(llmProviderId)
    const customApiBase =
      pid === 'custom' && llmCustomBase.trim() ? llmCustomBase.trim().replace(/\/$/, '') : undefined
    const llm = { providerId: pid, customApiBase }

    if (!keySaved) {
      redTeamGuestTurnRef.current = 0
    }

    const promises = selectedModelArray.map(modelId => {
      const modelObj = models.find(m => m.id === modelId)
      const modelName = modelObj?.name || modelId
      if (!keySaved && modelId === GUEST_DEMO_MODEL_ID) {
        const turnIdx = redTeamGuestTurnRef.current++
        return executeGuestDemoTestRound({
          modelId,
          modelName,
          prompt,
          turnIndex: turnIdx,
          runId: currentRunId,
          runLabel: effectiveRunLabel,
        })
      }
      return executeModelChatRound({
        apiKey,
        modelId,
        modelName,
        prompt,
        temperature,
        runId: currentRunId,
        runLabel: effectiveRunLabel,
        llm,
        externalSignal: runAbortController.signal,
        outputModalities: modelObj?.outputModalities,
        contextLength: modelObj?.context_length,
      })
    })

    // Stream results as they arrive (ignore stale results from cancelled runs)
    for (const p of promises) {
      p.then(r => {
        if (currentRunIdRef.current !== currentRunId) return
        setResults(prev => [...prev, r])
        setLastResultAt(Date.now())
      })
    }

    const completed = await Promise.all(promises)
    if (currentRunIdRef.current !== currentRunId) {
      return
    }
    setSelectedModels(new Set(selectedModelArray))
    setRunHistory(prev => [
      {
        id: currentRunId,
        label: effectiveRunLabel,
        timestamp: new Date().toISOString(),
        modelCount: selectedModelArray.length,
        results: completed,
      },
      ...prev,
    ].slice(0, 20))
    setLoading(false)
    if (runAbortRef.current === runAbortController) {
      runAbortRef.current = null
    }
  }

  const retryModelPrompt = async (modelId: string) => {
    const guestRetry = !keySaved && modelId === GUEST_DEMO_MODEL_ID
    if (!apiKey.trim() && !guestRetry) {
      setErrorMsg('API key is missing')
      return
    }
    if (!prompt.trim()) {
      setErrorMsg('Enter a prompt in section 3 to resend')
      return
    }
    if (retryingModels.includes(modelId)) return

    const snapshot = results.find(r => r.modelId === modelId)
    if (!snapshot) return

    setRetryingModels(prev => [...prev, modelId])
    setErrorMsg('')
    const modelObj = models.find(m => m.id === modelId)
    const modelName = modelObj?.name || modelId
    const pid = normalizeLlmProviderId(llmProviderId)
    const customApiBase =
      pid === 'custom' && llmCustomBase.trim() ? llmCustomBase.trim().replace(/\/$/, '') : undefined
    try {
      const newResult = guestRetry
        ? await executeGuestDemoTestRound({
            modelId,
            modelName,
            prompt,
            turnIndex: redTeamGuestTurnRef.current++,
            runId: snapshot.runId,
            runLabel: snapshot.runLabel,
          })
        : await executeModelChatRound({
            apiKey,
            modelId,
            modelName,
            prompt,
            temperature,
            runId: snapshot.runId,
            runLabel: snapshot.runLabel,
            llm: { providerId: pid, customApiBase },
            outputModalities: modelObj?.outputModalities,
            contextLength: modelObj?.context_length,
          })
      setResults(prev => prev.map(r => (r.modelId === modelId ? newResult : r)))
      setLastResultAt(Date.now())
      const rid = snapshot.runId
      if (rid) {
        setRunHistory(prev =>
          prev.map(h =>
            h.id === rid ? { ...h, results: h.results.map(r => (r.modelId === modelId ? newResult : r)) } : h,
          ),
        )
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message || 'Retry failed' : 'Retry failed')
    } finally {
      setRetryingModels(prev => prev.filter(id => id !== modelId))
    }
  }

  const loadRunSnapshot = (run: RunSnapshot) => {
    setResults(run.results)
  }

  const removeRunSnapshot = (runId: string) => {
    setRunHistory(prev => prev.filter(r => r.id !== runId))
  }

  const exportJSON = () => {
    const { filename, content } = buildJsonExport({
      results,
      runLabel,
      runHistory,
      prompt,
      temperature,
      promptClassify,
      summarizeResponseShape,
      responseRealismTag,
    })
    downloadFile(content, filename, 'application/json')
  }

  const exportMarkdown = () => {
    const { filename, content } = buildMarkdownExport({
      results,
      runLabel,
      runHistory,
      prompt,
      temperature,
      promptClassify,
      summarizeResponseShape,
      responseRealismTag,
    })
    downloadFile(content, filename, 'text/markdown')
  }

  const exportCSV = () => {
    const { filename, content } = buildCsvExport({
      results,
      runLabel,
      runHistory,
      prompt,
      temperature,
      promptClassify,
      summarizeResponseShape,
      responseRealismTag,
    })
    downloadFile(content, filename, 'text/csv;charset=utf-8')
  }

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const pendingCount = loading ? Math.max(selectedModels.size - results.length, 0) : 0
  const secondsSinceLastResult = lastResultAt ? Math.max(0, Math.floor((progressNow - lastResultAt) / 1000)) : null
  const compareRunA = runHistory.find(r => r.id === compareRunAId) || null
  const compareRunB = runHistory.find(r => r.id === compareRunBId) || null
  const activeChatResult = activeChatModelId ? getLatestResultForModel(activeChatModelId) : null
  const activeChatHistory = activeChatModelId ? (chatHistories[activeChatModelId] ?? []) : []
  const activeChatModelName = activeChatResult?.modelName || activeChatModelId || 'Model'

  useEffect(() => {
    if (!activeChatModelId) return
    const stillVisible = results.some(r => r.modelId === activeChatModelId)
    if (!stillVisible) closeContinueChat()
  }, [activeChatModelId, results])

  return (
    <div className="app app--chat-shell">
      <div className="app-comet-backdrop comet-field premium" ref={cometBackdropRef} aria-hidden />

      <main className="site-main site-main--chat-workspace">
        {errorMsg && (
          <div className="error-banner" role="alert">
            <span className="error-banner__msg">
              <strong>⚠ Error:</strong> {errorMsg}
            </span>
            <button
              type="button"
              className="btn btn--close workspace-ui-sheen"
              style={chatOrbSheenStyle('app:error:dismiss')}
              onClick={() => setErrorMsg('')}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <ChatWorkspace
          theme={theme}
          onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
          clearKey={clearKey}
          setAppMode={setAppMode}
          keySaved={keySaved}
          keyInput={keyInput}
          setKeyInput={setKeyInput}
          handleSaveKey={handleSaveKey}
          modelsLoading={modelsLoading}
          apiKeyPlaceholder={
            (getProviderInfo(normalizeLlmProviderId(llmProviderId)) ?? LLM_PROVIDERS[0]).keyPlaceholder
          }
          llmProviderId={llmProviderId}
          setLlmProviderId={setLlmProviderId}
          llmCustomBase={llmCustomBase}
          setLlmCustomBase={setLlmCustomBase}
          chatInput={chatInput}
          setChatInput={setChatInput}
          models={pickerModels}
          modelPickRequiresApiKey={!keySaved}
          guestDemoModelId={GUEST_DEMO_MODEL_ID}
          keyGateFocusNonce={keyGateFocusNonce}
          onKeyGateOpen={() => setKeyGateFocusNonce(n => n + 1)}
          groupChatModelIds={groupChatModelIds}
          toggleGroupChatModel={toggleGroupChatModel}
          groupChatMessages={groupChatMessages}
          groupChatSystemPrompt={groupChatSystemPrompt}
          sendGroupChat={sendGroupChat}
          groupChatLoading={groupChatLoading}
          removeGroupChatModelId={removeGroupChatModelId}
          clearGroupChat={closeGroupChatWithArchive}
          groupChatHistory={groupChatHistory}
          onRestoreGroupChatFromHistory={restoreGroupChatFromHistory}
          onRemoveGroupChatHistoryEntry={removeGroupChatHistoryEntry}
          onRefreshGroupChatHistory={refreshGroupChatHistory}
          keyBalance={keyBalance}
          creditsPurchaseUrl={
            getProviderInfo(normalizeLlmProviderId(llmProviderId))?.creditsPurchaseUrl ?? ''
          }
          billingEnabled={keySaved && normalizeLlmProviderId(llmProviderId) === 'openrouter'}
          feedbackUrl={
            (typeof import.meta.env.VITE_FEEDBACK_URL === 'string' && import.meta.env.VITE_FEEDBACK_URL.trim()) ||
            ''
          }
          downloadAppUrl={
            (typeof import.meta.env.VITE_DOWNLOAD_APP_URL === 'string' &&
              import.meta.env.VITE_DOWNLOAD_APP_URL.trim()) ||
            'https://github.com/sol087087-arch/RED-TEAM/archive/refs/heads/feature/chatbot-service.zip'
          }
          onExploreAddThreeCheapModels={exploreAddThreeCheapModels}
          onRegenerateGroupChatLine={regenerateGroupChatLine}
          regeneratingMessageIndex={regeneratingMessageIndex}
          onRemoveGroupChatMessage={removeGroupChatMessageAt}
          onSubmitUserMessageEdit={submitEditedUserMessage}
          runHistory={runHistory}
          onLoadRunSnapshot={loadRunSnapshot}
          onRemoveRunSnapshot={removeRunSnapshot}
          workspaceVariant={appMode === 'redteam' ? 'redteam' : 'chat'}
          redTeamMain={
            appMode === 'redteam' ? (
              <>
                <div className="chat-workspace__redteam-section-stack">
                  <RunSetupSection
                    selectedModelsSize={selectedModels.size}
                    totalModels={models.length}
                    modelsLoading={modelsLoading}
                    modelFilter={modelFilter}
                    setModelFilter={setModelFilter}
                    modelProviderFilter={modelProviderFilter}
                    setModelProviderFilter={setModelProviderFilter}
                    modelMonetizationFilter={modelMonetizationFilter}
                    setModelMonetizationFilter={setModelMonetizationFilter}
                    modelPriceBandFilter={modelPriceBandFilter}
                    setModelPriceBandFilter={setModelPriceBandFilter}
                    modelProviderOptions={modelProviderOptions}
                    priceTertileLabels={priceTertileLabels}
                    modelScaleBandFilter={modelScaleBandFilter}
                    setModelScaleBandFilter={setModelScaleBandFilter}
                    selectAllFiltered={selectAllFiltered}
                    clearSelection={clearSelection}
                    filteredModels={runSetupDisplayModels}
                    selectedModels={selectedModels}
                    toggleModel={toggleModel}
                    prompt={prompt}
                    mutationEnabled={mutationEnabled}
                    setMutationEnabled={setMutationEnabled}
                    mutationPrompt={mutationPrompt}
                    setMutationPrompt={setMutationPrompt}
                    mutationModelId={mutationModelId}
                    setMutationModelId={setMutationModelId}
                    mutationModelOptions={mutationModelOptions}
                    copyText={copyText}
                    copiedKey={copiedKey}
                    promptClassify={promptClassify}
                    classifyLoading={classifyLoading}
                    classifyUnavailable={classifyUnavailable}
                    setPrompt={setPrompt}
                    runLabel={runLabel}
                    setRunLabelTouched={setRunLabelTouched}
                    setRunLabel={setRunLabel}
                    autoRunLabel={autoRunLabel}
                    templateName={templateName}
                    templateTagsInput={templateTagsInput}
                    setTemplateNameTouched={setTemplateNameTouched}
                    setTemplateName={setTemplateName}
                    setTemplateTagsTouched={setTemplateTagsTouched}
                    setTemplateTagsInput={setTemplateTagsInput}
                    savePromptTemplate={savePromptTemplate}
                    selectedTemplateId={selectedTemplateId}
                    loadTemplateIntoPrompt={loadTemplateIntoPrompt}
                    promptLibrary={promptLibrary}
                    deleteTemplate={deleteTemplate}
                    handleRunTests={handleRunTests}
                    onAbortRun={abortRun}
                    loading={loading}
                    canRun={!loading && selectedModels.size > 0 && !!prompt.trim()}
                    resultsCount={results.length}
                    temperature={temperature}
                    setTemperatureFromString={(value) => setTemperature(clampTemperature(parseFloat(value)))}
                    temperatureMin={TEMPERATURE_MIN}
                    temperatureMax={TEMPERATURE_MAX}
                  />

                  <ResultsSection
                    runHistory={runHistory}
                    compareRunAId={compareRunAId}
                    compareRunBId={compareRunBId}
                    setCompareRunAId={setCompareRunAId}
                    setCompareRunBId={setCompareRunBId}
                    compareRunA={compareRunA}
                    compareRunB={compareRunB}
                    loading={loading}
                    results={results}
                    selectedModelsSize={selectedModels.size}
                    pendingCount={pendingCount}
                    secondsSinceLastResult={secondsSinceLastResult}
                    activeChatModelId={activeChatModelId}
                    activeChatResult={activeChatResult}
                    closeContinueChat={closeContinueChat}
                    activeChatHistory={activeChatHistory}
                    activeChatModelName={activeChatModelName}
                    chatError={chatError}
                    chatInput={chatInput}
                    setChatInput={setChatInput}
                    sendContinueChat={sendContinueChat}
                    chatLoading={chatLoading}
                    passCount={passCount}
                    blockCount={blockCount}
                    unknownCount={unknownCount}
                    errorCount={errorCount}
                    clearResults={clearResults}
                    exportCSV={exportCSV}
                    exportJSON={exportJSON}
                    exportMarkdown={exportMarkdown}
                    responseStatusBadgeClass={responseStatusBadgeClass}
                    replyStatusLine={replyStatusLine}
                    openContinueChat={openContinueChat}
                    copyText={copyText}
                    copiedKey={copiedKey}
                    retryModelPrompt={retryModelPrompt}
                    retryingModels={retryingModels}
                    hasPromptToRetry={!!prompt.trim()}
                    removeResultAt={removeResultAt}
                  />
                </div>
              </>
            ) : undefined
          }
        />
      </main>
    </div>
  )
}

export default App
