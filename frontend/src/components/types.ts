import type { ChatMessage, Model, PromptClassify, PromptTemplate, RunSnapshot, TestResult } from '../domain/types'
import type { ModelScaleBandFilter, PriceTertileOptionLabels } from '../features/models/filterModels'

export type ThemeMode = 'light' | 'dark'

export type ApiKeySectionProps = {
  theme: ThemeMode
  onToggleTheme: () => void
  keySaved: boolean
  clearKey: () => void
  highPrivacyMode: boolean
  setHighPrivacyMode: (value: boolean) => void
  keyInput: string
  setKeyInput: (value: string) => void
  handleSaveKey: () => Promise<void> | void
  modelsLoading: boolean
}

export type RunSetupSectionProps = {
  keySaved: boolean
  selectedModelsSize: number
  totalModels: number
  modelsLoading: boolean
  modelFilter: string
  setModelFilter: (value: string) => void
  modelProviderFilter: string
  setModelProviderFilter: (value: string) => void
  modelMonetizationFilter: 'all' | 'free' | 'paid'
  setModelMonetizationFilter: (value: 'all' | 'free' | 'paid') => void
  modelPriceBandFilter: 'all' | 'economy' | 'standard' | 'premium'
  setModelPriceBandFilter: (value: 'all' | 'economy' | 'standard' | 'premium') => void
  modelProviderOptions: readonly string[]
  priceTertileLabels: PriceTertileOptionLabels
  modelScaleBandFilter: ModelScaleBandFilter
  setModelScaleBandFilter: (value: ModelScaleBandFilter) => void
  selectAllFiltered: () => void
  clearSelection: () => void
  filteredModels: Model[]
  selectedModels: Set<string>
  toggleModel: (modelId: string) => void
  prompt: string
  copyText: (text: string, key: string) => Promise<void> | void
  copiedKey: string | null
  promptClassify: PromptClassify | null
  classifyLoading: boolean
  classifyUnavailable: boolean
  setPrompt: (value: string) => void
  runLabel: string
  setRunLabelTouched: (value: boolean) => void
  setRunLabel: (value: string) => void
  autoRunLabel: (promptText: string, templateName: string, currentLabel?: string) => string
  templateName: string
  templateTagsInput: string
  setTemplateNameTouched: (value: boolean) => void
  setTemplateName: (value: string) => void
  setTemplateTagsTouched: (value: boolean) => void
  setTemplateTagsInput: (value: string) => void
  savePromptTemplate: () => void
  selectedTemplateId: string
  loadTemplateIntoPrompt: (id: string) => void
  promptLibrary: PromptTemplate[]
  deleteTemplate: () => void
  handleRunTests: () => Promise<void> | void
  loading: boolean
  canRun: boolean
  resultsCount: number
  temperature: number
  setTemperatureFromString: (value: string) => void
  temperatureMin: number
  temperatureMax: number
}

export type ResultsSectionProps = {
  keySaved: boolean
  runHistory: RunSnapshot[]
  compareRunAId: string
  compareRunBId: string
  setCompareRunAId: (value: string) => void
  setCompareRunBId: (value: string) => void
  compareRunA: RunSnapshot | null
  compareRunB: RunSnapshot | null
  loading: boolean
  results: TestResult[]
  selectedModelsSize: number
  pendingCount: number
  secondsSinceLastResult: number | null
  activeChatModelId: string | null
  activeChatResult: TestResult | null
  closeContinueChat: () => void
  activeChatHistory: ChatMessage[]
  activeChatModelName: string
  chatError: string
  chatInput: string
  setChatInput: (value: string) => void
  sendContinueChat: () => Promise<void> | void
  chatLoading: boolean
  passCount: number
  blockCount: number
  unknownCount: number
  errorCount: number
  clearResults: () => void
  exportCSV: () => void
  exportJSON: () => void
  exportMarkdown: () => void
  responseStatusBadgeClass: (status: TestResult['status']) => string
  replyStatusLine: (status: TestResult['status']) => string
  openContinueChat: (result: TestResult) => void
  copyText: (text: string, key: string) => Promise<void> | void
  copiedKey: string | null
  retryModelPrompt: (modelId: string) => void
  retryingModels: readonly string[]
  hasPromptToRetry: boolean
}
