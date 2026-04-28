import { useState, useEffect, useRef, useMemo } from 'react'
import type { ChatMessage, Model, PromptClassify, PromptTemplate, RunSnapshot, TestResult } from './domain/types'
import { buildCsvExport, buildJsonExport, buildMarkdownExport, generateRunId } from './features/export/reportExport'
import {
  evaluateResponse,
  extractAssistantPayload,
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
import { autoRunLabel, classifyPromptLocal, suggestTemplateMeta } from './features/heuristics/promptHeuristics'
import { ApiKeySection, FirstPagePreview, ResultsSection, RunSetupSection } from './components'
import type { ThemeMode } from './components/types'
import { fetchOpenRouterModels, postOpenRouterChatCompletion } from './services/openrouterClient'
import { loadPromptLibrary, readStoredSession } from './services/storage'
import {
  API_KEY_SESSION_STORAGE_KEY,
  PRIVACY_MODE_STORAGE_KEY,
  PROMPT_LIBRARY_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from './services/storageKeys'
import './styles/index.css'

const DEFAULT_TEMPERATURE = 0.7
const TEMPERATURE_MIN = 0
const TEMPERATURE_MAX = 2
const MODEL_RESPONSE_TIMEOUT_MS = 8 * 60 * 1000
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
  return 'light'
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
}

async function executeModelChatRound(args: ExecuteModelChatArgs): Promise<TestResult> {
  const { apiKey, modelId, modelName, prompt, temperature, runId, runLabel } = args
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

  try {
    const result = await postOpenRouterChatCompletion({
      apiKey,
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      signal: ctrl.signal,
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
      const { text: content, finishReason, explicitRefusal } = extractAssistantPayload(choices?.[0])
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
  }
}

function App() {
  const headerRef = useRef<HTMLElement | null>(null)
  const cometFieldRef = useRef<HTMLDivElement | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [highPrivacyMode, setHighPrivacyMode] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [prompt, setPrompt] = useState('')
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
  const [promptClassify, setPromptClassify] = useState<PromptClassify | null>(null)
  const [classifyLoading, setClassifyLoading] = useState(false)
  const [classifyUnavailable, setClassifyUnavailable] = useState(false)
  const classifyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const classifyController = useRef<AbortController | null>(null)
  const classifyRequestId = useRef(0)
  const [footerHeight, setFooterHeight] = useState(80)
  const [lastResultAt, setLastResultAt] = useState<number | null>(null)
  const [progressNow, setProgressNow] = useState(() => Date.now())
  const [runLabel, setRunLabel] = useState('')
  const [runLabelTouched, setRunLabelTouched] = useState(false)
  const [runHistory, setRunHistory] = useState<RunSnapshot[]>([])
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
      setApiKey(normalizedSaved)
      setKeySaved(true)
      loadModels(normalizedSaved)
    } else if (saved) {
      sessionStorage.removeItem(API_KEY_SESSION_STORAGE_KEY)
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
      } else {
        sessionStorage.setItem(API_KEY_SESSION_STORAGE_KEY, apiKey)
      }
    } catch {
      /* ignore storage failures */
    }
  }, [keySaved, apiKey, highPrivacyMode])

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

  useEffect(() => {
    if (models.length === 0) return
    setSelectedModels(prev => {
      const valid = new Set(models.map(m => m.id))
      const next = new Set<string>()
      for (const id of prev) {
        if (valid.has(id)) next.add(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [models])

  useEffect(() => {
    const headerEl = headerRef.current
    if (!headerEl) return
    const recompute = () => {
      const h = headerEl.getBoundingClientRect().height
      if (!Number.isFinite(h) || h <= 0) return
      setFooterHeight(Math.max(56, Math.round(h / 2)))
    }
    recompute()

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => recompute())
      ro.observe(headerEl)
      return () => ro.disconnect()
    }

    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [])

  useEffect(() => {
    if (!keySaved) return
    if (classifyDebounce.current) {
      clearTimeout(classifyDebounce.current)
      classifyDebounce.current = null
    }
    if (classifyController.current) {
      classifyController.current.abort()
      classifyController.current = null
    }
    if (!prompt.trim()) {
      setPromptClassify(null)
      setClassifyLoading(false)
      setClassifyUnavailable(false)
      return
    }
    setPromptClassify(null)
    setClassifyUnavailable(false)
    setClassifyLoading(true)
    const c = new AbortController()
    const thisRequest = ++classifyRequestId.current
    classifyDebounce.current = setTimeout(() => {
      classifyController.current = c
      void (async () => {
        try {
          const res = await fetch('/api/prompt/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
            signal: c.signal,
          })
          if (thisRequest !== classifyRequestId.current) return
          if (!res.ok) {
            setPromptClassify(classifyPromptLocal(prompt))
            setClassifyUnavailable(true)
            return
          }
          const data = (await res.json()) as unknown
          if (thisRequest !== classifyRequestId.current) return
          if (
            typeof data === 'object' &&
            data !== null &&
            typeof (data as Record<string, unknown>).primary_category === 'string' &&
            typeof (data as Record<string, unknown>).confidence === 'number'
          ) {
            setPromptClassify(data as PromptClassify)
            setClassifyUnavailable(false)
          } else {
            setPromptClassify(classifyPromptLocal(prompt))
            setClassifyUnavailable(true)
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return
          if (thisRequest !== classifyRequestId.current) return
          setPromptClassify(classifyPromptLocal(prompt))
          setClassifyUnavailable(true)
        } finally {
          if (thisRequest === classifyRequestId.current) {
            setClassifyLoading(false)
          }
          if (classifyController.current === c) {
            classifyController.current = null
          }
        }
      })()
    }, 400)
    return () => {
      if (classifyDebounce.current) {
        clearTimeout(classifyDebounce.current)
        classifyDebounce.current = null
      }
      c.abort()
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
    const field = cometFieldRef.current
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
        duration = rand(6.2, 8.4)
        length = rand(20, 50)
        opacity = rand(0.28, 0.46)
      } else if (layer < 0.66) {
        duration = rand(4.8, 7.0)
        length = rand(40, 90)
        opacity = rand(0.36, 0.58)
      } else {
        duration = rand(3.4, 5.2)
        length = rand(70, 140)
        opacity = rand(0.52, 0.8)
      }

      // Positive angle keeps trajectory diagonally down-right.
      const angle = rand(24, 40)
      // Spread comets across full header width (left/center/right).
      const startX = rand(-220, window.innerWidth + 120)
      const startY = rand(-28, Math.max(80, window.innerHeight * 0.16))
      const distance = rand(300, 780)
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
      window.setTimeout(() => {
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
      const result = await postOpenRouterChatCompletion({
        apiKey,
        model: modelId,
        messages: nextHistory.map(m => ({ role: m.role, content: m.content })),
        temperature,
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
      const { text } = extractAssistantPayload(choices?.[0])
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
    setErrorMsg('')
    setModelsLoading(true)

    try {
      const result = await fetchOpenRouterModels(normalizedKey)
      if (!result.ok) {
        setErrorMsg(`Key verification failed (${result.status}): ${result.detail}`)
        return
      }

      if (!highPrivacyMode) {
        try {
          sessionStorage.setItem(API_KEY_SESSION_STORAGE_KEY, normalizedKey)
        } catch {
          /* ignore storage failures */
        }
      }
      setApiKey(normalizedKey)
      setKeySaved(true)
      setKeyInput('')
      setModels(result.models)
    } catch (error) {
      const msg = (error as Error).message
      setErrorMsg(
        `Network error: ${msg}. Use \`npm run dev\` (not opening the HTML file directly). If this persists, check firewall/VPN and that the API host is openrouter.ai.`
      )
    } finally {
      setModelsLoading(false)
    }
  }

  const loadModels = async (key: string) => {
    setModelsLoading(true)
    setErrorMsg('')
    try {
      const result = await fetchOpenRouterModels(key)
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
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setApiKey('')
    setKeySaved(false)
    setModels([])
    setModelProviderFilter('all')
    setModelMonetizationFilter('all')
    setModelPriceBandFilter('all')
    setModelScaleBandFilter('all')
    setSelectedModels(new Set())
    setPrompt('')
    setResults([])
    setTemperature(DEFAULT_TEMPERATURE)
  }

  const clearResults = () => {
    setResults([])
  }

  const toggleModel = (modelId: string) => {
    const newSelected = new Set(selectedModels)
    if (newSelected.has(modelId)) newSelected.delete(modelId)
    else newSelected.add(modelId)
    setSelectedModels(newSelected)
  }

  const selectAllFiltered = () => {
    const newSelected = new Set(selectedModels)
    filteredModels.forEach(m => newSelected.add(m.id))
    setSelectedModels(newSelected)
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

    setErrorMsg('')
    setLoading(true)
    setResults([])
    setLastResultAt(null)
    setProgressNow(Date.now())
    const currentRunId = generateRunId()
    const effectiveRunLabel = runLabel.trim() || `run-${new Date().toLocaleTimeString()}`

    const selectedModelArray = Array.from(selectedModels)

    const promises = selectedModelArray.map(modelId => {
      const modelName = models.find(m => m.id === modelId)?.name || modelId
      return executeModelChatRound({
        apiKey,
        modelId,
        modelName,
        prompt,
        temperature,
        runId: currentRunId,
        runLabel: effectiveRunLabel,
      })
    })

    // Stream results as they arrive
    for (const p of promises) {
      p.then(r => {
        setResults(prev => [...prev, r])
        setLastResultAt(Date.now())
      })
    }

    const completed = await Promise.all(promises)
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
  }

  const retryModelPrompt = async (modelId: string) => {
    if (!apiKey.trim()) {
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
    const modelName = models.find(m => m.id === modelId)?.name || modelId
    try {
      const newResult = await executeModelChatRound({
        apiKey,
        modelId,
        modelName,
        prompt,
        temperature,
        runId: snapshot.runId,
        runLabel: snapshot.runLabel,
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

  return (
    <div className="app">
      <header ref={headerRef} className="site-header">
        <div className="comet-field premium" ref={cometFieldRef} aria-hidden />
        <div className="site-header__inner">
          <div className="site-header__brand">
            <img
              className="site-header__mark"
              src="/logo12.png"
              alt=""
              decoding="async"
            />
            <div className="site-header__text">
              <img
                className="site-header__wordmark"
                src="/logo_text12.png"
                alt="TEAMTESTHUB.US"
                decoding="async"
              />
              <p className="site-header__subtitle">
                Test prompts against multiple models in parallel.
              </p>
            </div>
          </div>
          <img
            className="site-header__illustration"
            src="/skull12.png"
            alt=""
            aria-hidden
            decoding="async"
          />
        </div>
      </header>

      <main className="site-main">
        <div className="site-inner">
          {errorMsg && (
            <div className="error-banner" role="alert">
              <span className="error-banner__msg">
                <strong>⚠ Error:</strong> {errorMsg}
              </span>
              <button type="button" className="btn btn--close" onClick={() => setErrorMsg('')} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}

          <ApiKeySection
            theme={theme}
            onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            keySaved={keySaved}
            clearKey={clearKey}
            highPrivacyMode={highPrivacyMode}
            setHighPrivacyMode={setHighPrivacyMode}
            keyInput={keyInput}
            setKeyInput={setKeyInput}
            handleSaveKey={handleSaveKey}
            modelsLoading={modelsLoading}
          />
          {!keySaved && <FirstPagePreview />}

      <RunSetupSection
        keySaved={keySaved}
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
        filteredModels={filteredModels}
        selectedModels={selectedModels}
        toggleModel={toggleModel}
        prompt={prompt}
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
        loading={loading}
        canRun={!loading && selectedModels.size > 0 && !!prompt.trim()}
        resultsCount={results.length}
        temperature={temperature}
        setTemperatureFromString={(value) => setTemperature(clampTemperature(parseFloat(value)))}
        temperatureMin={TEMPERATURE_MIN}
        temperatureMax={TEMPERATURE_MAX}
      />

      <ResultsSection
        keySaved={keySaved}
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
      />
        </div>
      </main>
      <footer className="site-footer" style={{ height: `${footerHeight}px` }}>
        <div className="site-footer__inner">
          <img
            className="site-footer__illustration"
            src="/skull12.png"
            alt=""
            aria-hidden
            decoding="async"
          />
          <p className="site-footer__text">
            <span className="site-footer__mobile-only">
              No cookies · TEAMTESTHUB.US · {new Date().getFullYear()} ©
            </span>
            <span className="site-footer__desktop-only">
              © {new Date().getFullYear()} TEAMTESTHUB.US · All rights reserved · Privacy · Terms · No cookies. No personal
              tracking. API keys never reach our server.
            </span>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
