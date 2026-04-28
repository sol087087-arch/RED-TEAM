import { useMemo } from 'react'
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
import type { RunSetupSectionProps } from './types'
import selectAllFilteredIcon from '../assets/icons/actions/select-all-filtered.png'

export function RunSetupSection(props: RunSetupSectionProps) {
  const {
    keySaved,
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
    copyText,
    copiedKey,
    promptClassify,
    classifyLoading,
    classifyUnavailable,
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
    loading,
    canRun,
    resultsCount,
    temperature,
    setTemperatureFromString,
    temperatureMin,
    temperatureMax,
  } = props

  if (!keySaved) return null

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
        labelFull: 'Parameter scale — show all (no size filter)',
      },
      {
        value: 'small',
        labelShort: 'Small',
        labelFull: `Small: up to ~${SCALE_SMALL_MAX_B}B (inferred)`,
      },
      {
        value: 'medium',
        labelShort: 'Medium',
        labelFull: `Medium: ~${SCALE_SMALL_MAX_B}–${SCALE_LARGE_MIN_B}B (inferred)`,
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
        labelFull: 'Access cost — no filter (all listed rates)',
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
        labelFull: `Price tiers — no tertile filter (open Economy/Standard/Premium below for ~${LISTED_EXCHANGE_TOKEN_ASSUMPTION.promptTokens}+${LISTED_EXCHANGE_TOKEN_ASSUMPTION.completionTokens} tok/msg ranges)`,
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
        labelFull: 'Select saved template — load name, tags, and prompt from a row below',
      },
      ...promptLibrary.map(t => ({
        value: t.id,
        labelShort: t.name,
        labelFull: `${t.name}${t.tags.length ? ` · ${t.tags.join(', ')}` : ''}`,
      })),
    ],
    [promptLibrary]
  )

  return (
    <>
      <section className="section">
        <div className="section-header">
          <span className="section-num">2</span>
          <h2>Select Models ({selectedModelsSize} selected / {totalModels} available)</h2>
        </div>
        {modelsLoading ? (
          <p className="hint">Loading models...</p>
        ) : totalModels === 0 ? (
          <p className="hint">No models loaded. Try refreshing or reverifying your key.</p>
        ) : (
          <>
            <div className="input-row">
              <input
                type="text"
                placeholder="Filter models (e.g. 'llama', 'cheap', 'claude')..."
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
              />
              <button
                type="button"
                className="btn btn--match-action btn--icon-action"
                onClick={selectAllFiltered}
                aria-label="Select all filtered models"
                title="Select all filtered"
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
              <button
                type="button"
                className="btn btn--match-action btn--icon-action"
                onClick={clearSelection}
                aria-label="Clear selected models"
                title="Clear selected models"
              >
                <span className="response-action-icon response-action-icon--clear response-action-icon--btn-tone" aria-hidden="true" />
              </button>
            </div>
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
                buttonTitle={`Estimated size from model id/name (e.g. 7b, 70b, 8x7b MoE) and a few family keywords. OpenRouter does not list parameter counts. Cutoffs: small under ${SCALE_SMALL_MAX_B}B, medium ${SCALE_SMALL_MAX_B}–${SCALE_LARGE_MIN_B}B, large ${SCALE_LARGE_MIN_B}B+. Unclassified models are hidden when Small/Medium/Large is selected.`}
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
            <div className="model-grid-shell">
              <div className="model-grid">
                {filteredModels.map(model => {
                  const sizeLabel = formatModelParameterSizeLabel(model)
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
                        <div className="model-name">{model.name}</div>
                        <div className="model-meta">
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

      <section className="section">
        <div className="section-header">
          <span className="section-num">3</span>
          <h2>Test Prompt</h2>
          <button
            type="button"
            className="copy-icon-btn copy-icon-btn--header copy-icon-btn--icon-only"
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
        </div>
        {prompt.trim() && (
          <p className="hint prompt-classify" aria-live="polite">
            {promptClassify && (
              <span>
                <strong>Prompt heuristic</strong>: {promptClassify.primary_category} · rule match strength{' '}
                {(100 * promptClassify.confidence).toFixed(0)}%
                {promptClassify.secondary_categories.length > 0
                  ? ` · also: ${promptClassify.secondary_categories.join(', ')}`
                  : ''}
                {promptClassify.matched_rules.length > 0
                  ? ` · rules: ${promptClassify.matched_rules.join(', ')}`
                  : ''}
              </span>
            )}
            {classifyLoading && <span>Classifying…</span>}
            {!classifyLoading && classifyUnavailable && (
              <span> · API unavailable, using local heuristic fallback.</span>
            )}
          </p>
        )}
        <div className="scroll-fade-shell scroll-fade-shell--prompt">
          <div className="scroll-fade-viewport scroll-fade-viewport--prompt">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the prompt to test across all selected models..."
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
          <button
            type="button"
            className="btn btn--match-action btn--icon-action"
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
        </div>
        <div className="prompt-library">
          <div className="prompt-library__title">Prompt library</div>
          <p className="hint prompt-library__storage-note">
            Saved only in this browser (localStorage on your device). It is not uploaded to TeamTestHub or any server we run.
          </p>
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
            <button type="button" className="btn btn--action-fixed" onClick={savePromptTemplate}>
              Save template
            </button>
          </div>
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
              className="btn btn--mini-fixed btn--icon-action"
              onClick={() => selectedTemplateId && loadTemplateIntoPrompt(selectedTemplateId)}
              disabled={!selectedTemplateId}
              aria-label="Load selected template"
              title="Load selected template"
            >
              <span className="response-action-icon response-action-icon--load response-action-icon--btn-tone" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn--mini-fixed btn--icon-action"
              onClick={deleteTemplate}
              disabled={!selectedTemplateId}
              aria-label="Delete selected template"
              title="Delete selected template"
            >
              <span className="response-action-icon response-action-icon--clear response-action-icon--btn-tone" aria-hidden="true" />
            </button>
            <button type="button" className="btn btn--action-fixed" onClick={handleRunTests} disabled={!canRun}>
              Run selected
            </button>
          </div>
        </div>
        <div className="run-temperature-wrap">
          <div className="run-temperature-bar">
            <button
              type="button"
              className="btn btn--primary btn--run btn--match-action run-temperature-bar__btn"
              onClick={handleRunTests}
              disabled={!canRun}
            >
              {loading
                ? `Running tests... (${resultsCount}/${selectedModelsSize})`
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
                OpenRouter use {temperatureMin}–{temperatureMax}.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
