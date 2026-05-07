import { useEffect, useMemo, useState } from 'react'
import {
  formatModelProviderLabel,
} from '../features/models/filterModels'
import {
  SCALE_LARGE_MIN_B,
  SCALE_SMALL_MAX_B,
  formatModelParameterSizeLabel,
} from '../features/models/modelScaleBand'
import {
  LISTED_EXCHANGE_TOKEN_ASSUMPTION,
  formatUsdPerMillionOutputTokens,
} from '../utils/formatOpenRouterPricing'
import { FilterDropdown, type FilterDropdownItem } from './FilterDropdown'
import { ProviderIcon } from './ProviderIcon'
import type { RunSetupSectionProps } from './types'
import { formatTaxonomyLabel } from '../features/heuristics/harmTaxonomy'
import { simplifyModelDisplayName } from '../features/chat/modelChipLabel'
import { chatOrbSheenStyle } from '../features/chat/modelChipSheen'
import selectAllFilteredIcon from '../assets/icons/actions/select-all-filtered.png'
import mutationIcon from '../assets/icons/actions/mutation.png'

const MUTATION_CLASS_EXAMPLES: Array<{ id: string; title: string; details: string }> = [
  {
    id: 'language_obfuscation',
    title: 'Language Strategies / Obfuscation',
    details: 'Encoding tricks, base64 smuggling, homoglyphs, token-level payload hiding, prompt stylizing.',
  },
  {
    id: 'imaginary_worlds',
    title: 'Imaginary Worlds / Hypotheticals',
    details: 'Fictional scenarios, storytelling frames, "in a movie / dream / simulation" distancing, world-building.',
  },
  {
    id: 'roleplay_persona',
    title: 'Roleplay / Persona Impersonation',
    details: 'DAN-style, Eldritch horror, unrestricted persona, character play, authority spoofing.',
  },
  {
    id: 'rhetoric_persuasion',
    title: 'Rhetoric / Persuasion',
    details: 'Ethical reframing, flattery, socratic questioning, innocent-purpose framing, alignment hacking, conversational coercion.',
  },
  {
    id: 'dialogue_escalation',
    title: 'Dialogue-Based / Multi-Turn Escalation',
    details: 'Gradual ramp-up, many-shot priming, Crescendo-style slow burn, memory poisoning across turns.',
  },
  {
    id: 'prefix_override',
    title: 'Prefix / Privilege Escalation / System Override',
    details: 'Developer mode, master rule injection, direct system-prompt replacement, command hierarchies.',
  },
  {
    id: 'fragmentation_conflict',
    title: 'Fragmentation / Goal Conflict',
    details: 'Breaking instructions into harmless pieces, competing objectives, bait-and-rectify, decomposition attacks.',
  },
  {
    id: 'llm_operational',
    title: 'LLM Operational Exploitation',
    details: 'Meta-cognitive tricks, response stylizing, instruction modification, cognitive overload, attention misalignment.',
  },
  {
    id: 'automated_optimization',
    title: 'Automated / Adversarial Optimization',
    details: 'Seed-based templates + LLM-paraphrase loops (the smart mutator you already have).',
  },
]

export function RunSetupSection(props: RunSetupSectionProps) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false,
  )
  const [selectedMutationClassId, setSelectedMutationClassId] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const {
    selectedModelsSize,
    totalModels,
    modelsLoading,
    modelFilter,
    setModelFilter,
    modelProviderFilter,
    setModelProviderFilter,
    modelMonetizationFilter,
    setModelMonetizationFilter,
    modelPriceBandFilter,
    setModelPriceBandFilter,
    modelProviderOptions,
    priceTertileLabels,
    modelScaleBandFilter,
    setModelScaleBandFilter,
    selectAllFiltered,
    clearSelection,
    filteredModels,
    selectedModels,
    toggleModel,
    prompt,
    mutationEnabled,
    setMutationEnabled,
    mutationPrompt,
    setMutationPrompt,
    mutationModelId,
    setMutationModelId,
    mutationModelOptions,
    copyText,
    copiedKey,
    promptClassify,
    classifyLoading,
    setPrompt,
    runLabel,
    setRunLabelTouched,
    setRunLabel,
    autoRunLabel,
    templateName,
    templateTagsInput,
    setTemplateNameTouched,
    setTemplateName,
    setTemplateTagsTouched,
    setTemplateTagsInput,
    savePromptTemplate,
    selectedTemplateId,
    loadTemplateIntoPrompt,
    promptLibrary,
    deleteTemplate,
    handleRunTests,
    onAbortRun,
    loading,
    canRun,
    resultsCount,
    temperature,
    setTemperatureFromString,
    temperatureMin,
    temperatureMax,
  } = props

  const providerDropdownItems = useMemo<FilterDropdownItem[]>(
    () => [
      { value: 'all', labelShort: 'Provider families', labelFull: 'All provider families' },
      ...modelProviderOptions.map(id => ({
        value: id,
        labelShort: formatModelProviderLabel(id),
        labelFull: `${formatModelProviderLabel(id)} (${id})`,
      })),
    ],
    [modelProviderOptions]
  )

  const scaleDropdownItems = useMemo<FilterDropdownItem[]>(
    () => [
      {
        value: 'all',
        labelShort: 'Parameter scale',
        labelFull: 'Parameter scale - show all (no size filter)',
      },
      {
        value: 'small',
        labelShort: 'Small',
        labelFull: `Small: up to ~${SCALE_SMALL_MAX_B}B (inferred)`,
      },
      {
        value: 'medium',
        labelShort: 'Medium',
        labelFull: `Medium: ~${SCALE_SMALL_MAX_B}-${SCALE_LARGE_MIN_B}B (inferred)`,
      },
      {
        value: 'large',
        labelShort: 'Large',
        labelFull: `Large: ~${SCALE_LARGE_MIN_B}B+ (inferred)`,
      },
    ],
    []
  )

  const accessDropdownItems = useMemo<FilterDropdownItem[]>(
    () => [
      {
        value: 'all',
        labelShort: 'Access cost',
        labelFull: 'Access cost - no filter (all listed rates)',
      },
      { value: 'free', labelShort: 'Free', labelFull: 'Free: listed $0 input & output' },
      { value: 'paid', labelShort: 'Paid', labelFull: 'Paid: non-zero or unlisted rates' },
    ],
    []
  )

  const priceTierDropdownItems = useMemo<FilterDropdownItem[]>(
    () => [
      {
        value: 'all',
        labelShort: 'Price tiers',
        labelFull: `Price tiers - no tertile filter (open Economy/Standard/Premium below for ~${LISTED_EXCHANGE_TOKEN_ASSUMPTION.promptTokens}+${LISTED_EXCHANGE_TOKEN_ASSUMPTION.completionTokens} tok/msg ranges)`,
      },
      {
        value: 'economy',
        labelShort: 'Economy',
        labelFull: `Economy: ${priceTertileLabels.economy}`,
      },
      {
        value: 'standard',
        labelShort: 'Standard',
        labelFull: `Standard: ${priceTertileLabels.standard}`,
      },
      {
        value: 'premium',
        labelShort: 'Premium',
        labelFull: `Premium: ${priceTertileLabels.premium}`,
      },
    ],
    [priceTertileLabels]
  )

  const priceTierButtonTitle =
    modelPriceBandFilter === 'all'
      ? `Filter by listed output-price tertile. Full ranges appear in the menu. Uses ~${LISTED_EXCHANGE_TOKEN_ASSUMPTION.promptTokens} prompt + ~${LISTED_EXCHANGE_TOKEN_ASSUMPTION.completionTokens} completion tokens per estimate.`
      : modelPriceBandFilter === 'economy'
        ? `${priceTertileLabels.economy}. ~${LISTED_EXCHANGE_TOKEN_ASSUMPTION.promptTokens} prompt + ~${LISTED_EXCHANGE_TOKEN_ASSUMPTION.completionTokens} tok/msg assumed.`
        : modelPriceBandFilter === 'standard'
          ? `${priceTertileLabels.standard}. ~${LISTED_EXCHANGE_TOKEN_ASSUMPTION.promptTokens} prompt + ~${LISTED_EXCHANGE_TOKEN_ASSUMPTION.completionTokens} tok/msg assumed.`
          : `${priceTertileLabels.premium}. ~${LISTED_EXCHANGE_TOKEN_ASSUMPTION.promptTokens} prompt + ~${LISTED_EXCHANGE_TOKEN_ASSUMPTION.completionTokens} tok/msg assumed.`

  const templateDropdownItems = useMemo<FilterDropdownItem[]>(
    () => [
      {
        value: '',
        labelShort: 'Select saved template',
        labelFull: 'Select saved template - load name, tags, and prompt from a row below',
      },
      ...promptLibrary.map(t => ({
        value: t.id,
        labelShort: t.name,
        labelFull: `${t.name}${t.tags.length ? ` · ${t.tags.join(', ')}` : ''}`,
      })),
    ],
    [promptLibrary]
  )

  const mutationModelDropdownItems = useMemo<FilterDropdownItem[]>(
    () => [
      {
        value: '',
        labelShort: 'Select mutation model',
        labelFull: 'Select mutation model',
      },
      ...mutationModelOptions.map(model => {
        const short = simplifyModelDisplayName(model.name || model.id)
        return {
          value: model.id,
          labelShort: short,
          labelFull: `${short} (${model.id})`,
        }
      }),
    ],
    [mutationModelOptions]
  )
  const mutationClassDropdownItems = useMemo<FilterDropdownItem[]>(
    () => [
      {
        value: '',
        labelShort: 'Mutation classes',
        labelFull: 'Select mutation class',
      },
      ...MUTATION_CLASS_EXAMPLES.map(item => ({
        value: item.id,
        labelShort: item.title,
        labelFull: item.title,
      })),
    ],
    []
  )
  const selectedMutationClass = useMemo(
    () => MUTATION_CLASS_EXAMPLES.find(item => item.id === selectedMutationClassId) ?? null,
    [selectedMutationClassId]
  )

  const allFilteredSelected = filteredModels.length > 0 && filteredModels.every(model => selectedModels.has(model.id))

  const handleMobileFilteredToggle = () => {
    if (allFilteredSelected) {
      clearSelection()
      return
    }
    selectAllFiltered()
  }

  const shortClassifyText = useMemo(() => {
    if (!promptClassify || promptClassify.primary_category === 'unknown') return ''
    const parts: string[] = []
    parts.push(formatTaxonomyLabel(promptClassify.primary_category))
    if (promptClassify.secondary_categories.length > 0) {
      parts.push(
        `also ${formatTaxonomyLabel(promptClassify.secondary_categories[0])}`
      )
    }
    if (promptClassify.matched_rules.length > 0) parts.push(`rule ${promptClassify.matched_rules[0]}`)
    return parts.slice(0, 3).join(' · ')
  }, [promptClassify])

  return (
    <>
      <section className="section" id="redteam-explore-anchor">
        <div className="section-header">
          <h2>
            <span className="redteam-section-mark" aria-hidden="true" />
            <span>
              Select models ({isMobile ? `${selectedModelsSize}/${totalModels}` : `${selectedModelsSize} selected / ${totalModels} available`})
            </span>
          </h2>
        </div>
        {modelsLoading ? (
          <p className="hint">Loading models...</p>
        ) : totalModels === 0 ? (
          <p className="hint">No models loaded. Try refreshing or reverifying your key.</p>
        ) : (
          <>
            <div className={`input-row ${isMobile ? 'input-row--model-filter-mobile' : ''}`}>
              <input
                type="text"
                className="model-filter-input"
                placeholder="Filter models (e.g. 'cheap', 'economy', 'large', 'anthropic')..."
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
              />
              <button
                type="button"
                className={`btn btn--match-action btn--icon-action workspace-ui-sheen ${isMobile ? 'model-filter-toggle-btn' : ''}`}
                style={chatOrbSheenStyle('redteam:filter:select-all')}
                onClick={isMobile ? handleMobileFilteredToggle : selectAllFiltered}
                aria-label="Select all filtered models"
                title={isMobile ? (allFilteredSelected ? 'Clear selection' : 'Select all filtered') : 'Select all filtered'}
              >
                <span
                  className="response-action-icon response-action-icon--select-all response-action-icon--btn-tone"
                  style={{
                    WebkitMaskImage: `url(${selectAllFilteredIcon})`,
                    maskImage: `url(${selectAllFilteredIcon})`,
                  }}
                  aria-hidden="true"
                />
              </button>
              {!isMobile && (
                <button
                  type="button"
                  className="btn btn--match-action btn--icon-action workspace-ui-sheen"
                  style={chatOrbSheenStyle('redteam:filter:clear-selection')}
                  onClick={clearSelection}
                  aria-label="Clear selected models"
                  title="Clear selected models"
                >
                  <span className="response-action-icon response-action-icon--clear response-action-icon--btn-tone" aria-hidden="true" />
                </button>
              )}
            </div>
            {isMobile && (
              <p className="hint model-filter-hint-mobile">Try: cheap, economy, large, anthropic, cloud, free</p>
            )}
            {!isMobile && (
              <div className="input-row model-filter-presets">
                <FilterDropdown
                  ariaLabel="Provider family"
                  buttonTitle="Namespace segment before / in the model id (OpenRouter provider scope). Full ids appear in the menu."
                  value={modelProviderFilter}
                  onChange={setModelProviderFilter}
                  items={providerDropdownItems}
                />
                <FilterDropdown
                  ariaLabel="Parameter scale"
                  buttonTitle={`Estimated size from model id/name (e.g. 7b, 70b, 8x7b MoE) and a few family keywords. OpenRouter does not list parameter counts. Cutoffs: small under ${SCALE_SMALL_MAX_B}B, medium ${SCALE_SMALL_MAX_B}-${SCALE_LARGE_MIN_B}B, large ${SCALE_LARGE_MIN_B}B+. Unclassified models are hidden when Small/Medium/Large is selected.`}
                  value={modelScaleBandFilter}
                  onChange={value =>
                    setModelScaleBandFilter(value as 'all' | 'small' | 'medium' | 'large')
                  }
                  items={scaleDropdownItems}
                />
                <FilterDropdown
                  ariaLabel="Listed access cost"
                  buttonTitle="Based on listed USD rates in the catalog ($0 on both axes = free). Details in the menu."
                  value={modelMonetizationFilter}
                  onChange={value =>
                    setModelMonetizationFilter(value as 'all' | 'free' | 'paid')
                  }
                  items={accessDropdownItems}
                />
                <FilterDropdown
                  ariaLabel="Output price tier"
                  buttonTitle={priceTierButtonTitle}
                  value={modelPriceBandFilter}
                  onChange={value =>
                    setModelPriceBandFilter(value as 'all' | 'economy' | 'standard' | 'premium')
                  }
                  items={priceTierDropdownItems}
                />
              </div>
            )}
            <div className="model-grid-shell">
              <div className="model-grid">
                {filteredModels.map(model => {
                  const sizeLabel = formatModelParameterSizeLabel(model)
                  const mobileMetaParts = [
                    model.context_length ? `${model.context_length.toLocaleString()} CTX` : '',
                    model.pricing
                      ? formatUsdPerMillionOutputTokens(model.pricing.completionPerTokenUsd)
                      : '',
                  ].filter(Boolean)
                  return (
                    <label
                      key={model.id}
                      className={`model-item ${selectedModels.has(model.id) ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedModels.has(model.id)}
                        onChange={() => toggleModel(model.id)}
                      />
                      <div className="model-body">
                        <div className="model-name-row">
                          <ProviderIcon modelId={model.id} size={20} className="model-name-row__icon" />
                          <div className="model-name">{simplifyModelDisplayName(model.name || model.id)}</div>
                        </div>
                        <div className="model-meta">
                          {isMobile
                            ? mobileMetaParts.join(' · ')
                            : (
                              <>
                                {model.id}
                                {model.context_length
                                  ? ` · ${model.context_length.toLocaleString()} ctx`
                                  : ''}
                                {sizeLabel ? ` · ${sizeLabel}` : ''}
                                {model.pricing
                                  ? ` · ${formatUsdPerMillionOutputTokens(
                                      model.pricing.completionPerTokenUsd
                                    )}`
                                  : ''}
                              </>
                              )}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="section section--prompt-run-stack">
        <div className="section-header">
          <h2>
            <span className="redteam-section-mark" aria-hidden="true" />
            <span>Test prompt</span>
          </h2>
        </div>
        {prompt.trim() && (
          <p className="hint prompt-classify" aria-live="polite">
            {classifyLoading && <span>Classifying…</span>}
            {!classifyLoading && promptClassify && promptClassify.primary_category !== 'unknown' && (
              isMobile ? (
                <span>{shortClassifyText}</span>
              ) : (
                <span>
                  <strong>Harm taxonomy</strong>: {formatTaxonomyLabel(promptClassify.primary_category)} · match strength{' '}
                  {(100 * promptClassify.confidence).toFixed(0)}%
                  {promptClassify.secondary_categories.length > 0
                    ? ` · also: ${promptClassify.secondary_categories.map(formatTaxonomyLabel).join(', ')}`
                    : ''}
                  {promptClassify.matched_rules.length > 0
                    ? ` · rules: ${promptClassify.matched_rules.join(', ')}`
                    : ''}
                </span>
              )
            )}
            {!classifyLoading && promptClassify?.primary_category === 'unknown' && (
              <span>No harm-domain taxonomy triggers matched yet.</span>
            )}
          </p>
        )}
        <div className="scroll-fade-shell scroll-fade-shell--prompt scroll-fade-shell--prompt-inset-copy">
          <button
            type="button"
            className="copy-icon-btn copy-icon-btn--icon-only copy-icon-btn--prompt-inset workspace-ui-sheen"
            style={chatOrbSheenStyle('redteam:copy:prompt')}
            onClick={() => copyText(prompt, 'prompt')}
            aria-label="Copy prompt"
            title="Copy prompt"
          >
            {copiedKey === 'prompt' ? (
              '✓'
            ) : (
              <span className="response-action-icon response-action-icon--copy" aria-hidden="true" />
            )}
          </button>
          <div className="scroll-fade-viewport scroll-fade-viewport--prompt">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.shiftKey) return
                if (e.nativeEvent.isComposing) return
                e.preventDefault()
                if (!canRun || loading) return
                void handleRunTests()
              }}
              placeholder="Enter the prompt to test across all selected models..."
              title="Enter — run test · Shift+Enter — new line"
              rows={6}
            />
          </div>
        </div>
        <div className="run-label-row__title">Run Name</div>
        <div className="input-row run-label-row">
          <div className="run-label-field">
            <span className="run-label-field__hint">Name For This Run</span>
            <input
              type="text"
              value={runLabel}
              onChange={(e) => {
                setRunLabelTouched(true)
                setRunLabel(e.target.value)
              }}
              placeholder="Name this run (e.g. Roleplay: scene A); temp & time live in exports"
              maxLength={80}
            />
          </div>
          {!isMobile && (
            <button
              type="button"
              className="btn btn--match-action btn--icon-action workspace-ui-sheen"
              style={chatOrbSheenStyle('redteam:run-label:regenerate')}
              onClick={() => {
                setRunLabelTouched(true)
                setRunLabel(autoRunLabel(prompt, templateName, runLabel))
              }}
              disabled={!prompt.trim()}
              aria-label="Regenerate run name"
              title="Regenerate run name from heuristics"
            >
              <span className="response-action-icon response-action-icon--reload response-action-icon--btn-tone" aria-hidden="true" />
            </button>
          )}
        </div>
        {!isMobile && (
          <div className="prompt-library">
            <div className="prompt-library__title">Prompt library</div>
            <div className="input-row">
              <div className="prompt-library__field">
                <span className="prompt-library__field-hint">Prompt Name</span>
                <input
                  type="text"
                  className="prompt-library__name-input"
                  value={templateName}
                  onChange={(e) => {
                    setTemplateNameTouched(true)
                    setTemplateName(e.target.value)
                  }}
                  placeholder="Prompt name"
                  maxLength={80}
                />
              </div>
              <div className="prompt-library__field">
                <span className="prompt-library__field-hint">Prompt Tags</span>
                <input
                  type="text"
                  className="prompt-library__tags-input"
                  value={templateTagsInput}
                  onChange={(e) => {
                    setTemplateTagsTouched(true)
                    setTemplateTagsInput(e.target.value)
                  }}
                  placeholder="#prompt_tag, #roleplay, #jailbreak"
                  maxLength={160}
                />
              </div>
              <button
                type="button"
                className="btn btn--match-action btn--icon-action prompt-library__mutation-btn workspace-ui-sheen"
                style={chatOrbSheenStyle('redteam:prompt:mutation-toggle')}
                aria-label="Mutation"
                title="Mutation"
                onClick={() => setMutationEnabled(!mutationEnabled)}
              >
                <span
                  className="response-action-icon response-action-icon--mutation response-action-icon--btn-tone"
                  style={{
                    WebkitMaskImage: `url(${mutationIcon})`,
                    maskImage: `url(${mutationIcon})`,
                  }}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                className="btn btn--action-fixed workspace-ui-sheen"
                style={chatOrbSheenStyle('redteam:template:save')}
                onClick={savePromptTemplate}
              >
                Save template
              </button>
            </div>
            {mutationEnabled && (
              <div className="prompt-mutation-wrap">
                <p className="hint prompt-mutation-wrap__wip-note" role="note">
                  <strong>Preview only.</strong> The mutation engine is not connected to test runs yet. We plan to
                  extend this so a mutator model can rewrite prompts before multi-model comparison.
                </p>
                <div className="scroll-fade-shell scroll-fade-shell--prompt">
                  <div className="scroll-fade-viewport scroll-fade-viewport--prompt">
                    <textarea
                      value={mutationPrompt}
                      onChange={(e) => setMutationPrompt(e.target.value)}
                      placeholder="Enter mutation prompt for the mutator model..."
                      rows={6}
                    />
                  </div>
                </div>
                <div className="input-row prompt-mutation-wrap__model-row">
                  <div className="prompt-mutation-wrap__half">
                    <FilterDropdown
                      ariaLabel="Mutation model"
                      buttonTitle="Choose which model acts as the mutator."
                      value={mutationModelId}
                      onChange={setMutationModelId}
                      items={mutationModelDropdownItems}
                    />
                  </div>
                  <div className="prompt-mutation-wrap__half">
                    <FilterDropdown
                      ariaLabel="Mutation class"
                      buttonTitle="Choose mutation class examples"
                      value={selectedMutationClassId}
                      onChange={setSelectedMutationClassId}
                      items={mutationClassDropdownItems}
                    />
                    {selectedMutationClass && (
                      <p className="hint prompt-mutation-class-detail">
                        <strong>{selectedMutationClass.title}</strong>: {selectedMutationClass.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="input-row prompt-library__row">
              <FilterDropdown
                ariaLabel="Saved prompt template"
                buttonTitle="Templates are stored only in this browser. Open the menu for tags and details."
                value={selectedTemplateId}
                onChange={loadTemplateIntoPrompt}
                items={templateDropdownItems}
              />
              <button
                type="button"
                className="btn btn--mini-fixed btn--icon-action workspace-ui-sheen"
                style={chatOrbSheenStyle('redteam:template:load')}
                onClick={() => selectedTemplateId && loadTemplateIntoPrompt(selectedTemplateId)}
                disabled={!selectedTemplateId}
                aria-label="Load selected template"
                title="Load selected template"
              >
                <span className="response-action-icon response-action-icon--load response-action-icon--btn-tone" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn--mini-fixed btn--icon-action workspace-ui-sheen"
                style={chatOrbSheenStyle('redteam:template:delete')}
                onClick={deleteTemplate}
                disabled={!selectedTemplateId}
                aria-label="Delete selected template"
                title="Delete selected template"
              >
                <span className="response-action-icon response-action-icon--clear response-action-icon--btn-tone" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={['btn btn--action-fixed workspace-ui-sheen', loading ? 'btn--danger' : ''].join(' ')}
                style={chatOrbSheenStyle('redteam:run:selected')}
                onClick={loading ? onAbortRun : handleRunTests}
                disabled={!loading && !canRun}
              >
                {loading ? '⏹ Stop' : 'Run selected'}
              </button>
            </div>
          </div>
        )}
        <div className="run-temperature-wrap">
          <div className="run-temperature-bar">
            <button
              type="button"
              className={[
                'btn btn--run btn--match-action run-temperature-bar__btn workspace-ui-sheen',
                loading ? 'btn--danger' : 'btn--primary',
              ].join(' ')}
              style={chatOrbSheenStyle('redteam:run:primary')}
              onClick={loading ? onAbortRun : handleRunTests}
              disabled={!loading && !canRun}
            >
              {loading
                ? `⏹ Stop (${resultsCount}/${selectedModelsSize})`
                : `▶ Run Against ${selectedModelsSize} Models`}
            </button>
            <div className="run-temperature-bar__scale">
              <div className="run-temperature-bar__scale-top">
                <label className="run-temperature-bar__scale-label" htmlFor="run-temperature">
                  Temp
                </label>
                <div className="run-temperature-bar__scale-slider-wrap">
                  <input
                    id="run-temperature"
                    className="temperature-range"
                    type="range"
                    min={temperatureMin}
                    max={temperatureMax}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => setTemperatureFromString(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <span className="run-temperature-bar__scale-value" aria-live="polite">
                  {temperature.toFixed(1)}
                </span>
              </div>
              <p className="hint run-temperature-bar__hint">
                <strong>Lower</strong>: more deterministic. <strong>Higher</strong>: more varied. Most models on
                OpenRouter use {temperatureMin}-{temperatureMax}.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
