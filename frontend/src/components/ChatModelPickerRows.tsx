import { useEffect, useMemo, useRef, useState } from 'react'
import type { Model } from '../domain/types'
import { buildChatModelSections } from '../features/chat/chatHomeModelSections'
import { filterModelsByMentionToken } from '../features/chat/composerMentionQuery'
import { simplifyModelDisplayName } from '../features/chat/modelChipLabel'
import { modelChipSheenStyle } from '../features/chat/modelChipSheen'
import { sortModelsByPopularity } from '../features/chat/modelPopularitySort'
import { ProviderIcon } from './ProviderIcon'

export type ChatModelPickerRowsProps = {
  models: readonly Model[]
  modelsLoading: boolean
  /** Token after `@` in the composer - drives a top “matches” row above category carousels */
  composerMentionQuery?: string
  onPickModel?: (model: Model) => void
  onKeyRequired?: () => void
  /** Highlight chips that are in the group-chat selection */
  selectedModelIds?: ReadonlySet<string>
  /** When set, only this model id is pickable; others are dimmed (parent still handles click) */
  modelPickRequiresApiKey?: boolean
  guestDemoModelId?: string
}

function IconChevronLeft() {
  return (
    <svg className="chat-model-rows__chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 6l-6 6 6 6" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg className="chat-model-rows__chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 6l6 6-6 6" />
    </svg>
  )
}

const SCROLL_EPS = 2

export function ChatModelPickerRows(props: ChatModelPickerRowsProps) {
  const {
    models,
    modelsLoading,
    composerMentionQuery = '',
    onPickModel,
    onKeyRequired,
    selectedModelIds,
    modelPickRequiresApiKey = false,
    guestDemoModelId = '',
  } = props

  const mentionToken = composerMentionQuery.trim()

  const matchingModels = useMemo(() => {
    if (!mentionToken) return []
    const raw = filterModelsByMentionToken(models, mentionToken)
    return sortModelsByPopularity(raw)
  }, [models, mentionToken])

  const sections = useMemo(() => {
    const base = buildChatModelSections(models)
    if (!mentionToken) return base
    const ids = new Set(matchingModels.map(m => m.id))
    if (ids.size === 0) return base
    return base
      .map(s => ({
        ...s,
        models: s.models.filter(m => !ids.has(m.id)),
      }))
      .filter(s => s.models.length > 0)
  }, [models, mentionToken, matchingModels])

  if (modelsLoading) {
    return (
      <div className="chat-model-rows chat-model-rows--loading" aria-live="polite">
        <p className="chat-model-rows__loading-msg hint">Loading models…</p>
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="chat-model-rows chat-model-rows--empty">
        <p className="hint chat-model-rows__empty-msg">No models returned - check your API key and provider.</p>
      </div>
    )
  }

  return (
    <div className="chat-model-rows" id="chat-workspace-model-picker">
      {mentionToken ? (
        matchingModels.length > 0 ? (
          <ChatModelRowSection
            key="mention-matches"
            sectionId="mention"
            title={`@${mentionToken}`}
            models={matchingModels}
            onPickModel={onPickModel}
            onKeyRequired={onKeyRequired}
            selectedModelIds={selectedModelIds}
            modelPickRequiresApiKey={modelPickRequiresApiKey}
            guestDemoModelId={guestDemoModelId}
            ariaLiveMatches
          />
        ) : (
          <section
            className="chat-model-rows__section chat-model-rows__section--mention-empty"
            aria-label={`No models for @${mentionToken}`}
            aria-live="polite"
          >
            <div className="chat-model-rows__head">
              <h3 className="chat-model-rows__title">{`@${mentionToken}`}</h3>
            </div>
            <p className="chat-model-rows__empty-mention hint">No models match.</p>
          </section>
        )
      ) : null}
      {sections.map(section => (
        <ChatModelRowSection
          key={section.id}
          sectionId={section.id}
          title={section.title}
          models={section.models}
          onPickModel={onPickModel}
          onKeyRequired={onKeyRequired}
          selectedModelIds={selectedModelIds}
          modelPickRequiresApiKey={modelPickRequiresApiKey}
          guestDemoModelId={guestDemoModelId}
        />
      ))}
    </div>
  )
}

function ModelCarouselChip(props: {
  model: Model
  onPickModel?: (model: Model) => void
  onKeyRequired?: () => void
  selected?: boolean
  needsApiKey?: boolean
  guestDemoModelId?: string
}) {
  const { model, onPickModel, onKeyRequired, selected, needsApiKey, guestDemoModelId } = props
  const locked = Boolean(needsApiKey && guestDemoModelId && model.id !== guestDemoModelId)
  const chipLabel = simplifyModelDisplayName(model.name || model.id)
  return (
    <button
      type="button"
      className={[
        'chat-model-chip',
        selected ? 'chat-model-chip--selected' : '',
        locked ? 'chat-model-chip--needs-key' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-selected={selected ? true : undefined}
      onClick={() => locked ? onKeyRequired?.() : onPickModel?.(model)}
      title={
        locked
          ? `Enter API key to use ${chipLabel}`
          : `${chipLabel} (${model.id})`
      }
    >
      <span
        className="chat-model-chip__avatar"
        aria-hidden
        style={modelChipSheenStyle(model.id)}
      >
        <ProviderIcon modelId={model.id} size={22} className="chat-model-chip__icon" />
      </span>
      <span className="chat-model-chip__label">{chipLabel}</span>
    </button>
  )
}

function ChatModelRowSection(props: {
  sectionId: string
  title: string
  models: readonly Model[]
  onPickModel?: (model: Model) => void
  onKeyRequired?: () => void
  selectedModelIds?: ReadonlySet<string>
  modelPickRequiresApiKey?: boolean
  guestDemoModelId?: string
  /** Top mention row: polite live region when the chip set changes */
  ariaLiveMatches?: boolean
}) {
  const {
    sectionId,
    title,
    models,
    onPickModel,
    onKeyRequired,
    selectedModelIds,
    modelPickRequiresApiKey = false,
    guestDemoModelId = '',
    ariaLiveMatches = false,
  } = props
  const expandPanelId = `chat-model-expand-${sectionId}`
  const seeAllBtnId = `chat-model-see-all-${sectionId}`
  const sectionRef = useRef<HTMLElement | null>(null)
  const trackRef = useRef<HTMLUListElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [expandOpen, setExpandOpen] = useState(false)

  const updateArrowState = () => {
    const el = trackRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScroll = Math.max(0, scrollWidth - clientWidth)
    setCanScrollLeft(scrollLeft > SCROLL_EPS)
    setCanScrollRight(maxScroll > SCROLL_EPS && scrollLeft < maxScroll - SCROLL_EPS)
  }

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    updateArrowState()
    el.addEventListener('scroll', updateArrowState, { passive: true })
    const ro = new ResizeObserver(() => updateArrowState())
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateArrowState)
      ro.disconnect()
    }
  }, [models])

  useEffect(() => {
    if (!expandOpen) return
    const onDoc = (e: MouseEvent) => {
      const root = sectionRef.current
      if (root && !root.contains(e.target as Node)) setExpandOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [expandOpen])

  const scrollByDelta = (delta: number) => {
    const el = trackRef.current
    if (!el) return
    const step = Math.min(280, Math.max(160, el.clientWidth * 0.85))
    el.scrollBy({ left: delta * step, behavior: 'smooth' })
  }

  const pickModel = (model: Model) => {
    setExpandOpen(false)
    onPickModel?.(model)
  }

  return (
    <section
      ref={sectionRef}
      className={['chat-model-rows__section', ariaLiveMatches ? 'chat-model-rows__section--mention-matches' : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={title}
      id={`chat-model-section-${sectionId}`}
      aria-live={ariaLiveMatches ? 'polite' : undefined}
    >
      <div className="chat-model-rows__head">
        <h3 className="chat-model-rows__title">{title} <span className="chat-model-rows__title-count">({models.length})</span></h3>
        <button
          type="button"
          className={`chat-model-rows__see-all${expandOpen ? ' chat-model-rows__see-all--open' : ''}`}
          aria-expanded={expandOpen}
          aria-controls={expandPanelId}
          id={seeAllBtnId}
          onClick={() => setExpandOpen(o => !o)}
        >
          {expandOpen ? 'Hide' : 'See all'}
        </button>
      </div>
      <div className="chat-model-rows__strip">
        <button
          type="button"
          className="chat-model-rows__fab-prev"
          onClick={() => scrollByDelta(-1)}
          disabled={!canScrollLeft}
          aria-label={`Scroll ${title} left`}
        >
          <IconChevronLeft />
        </button>
        <ul ref={trackRef} className="chat-model-rows__track">
          {models.map(model => (
            <li key={model.id} className="chat-model-rows__cell">
              <ModelCarouselChip
                model={model}
                onPickModel={pickModel}
                selected={selectedModelIds?.has(model.id) ?? false}
                needsApiKey={modelPickRequiresApiKey}
                onKeyRequired={onKeyRequired}
                guestDemoModelId={guestDemoModelId}
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="chat-model-rows__fab-next"
          onClick={() => scrollByDelta(1)}
          disabled={!canScrollRight}
          aria-label={`Scroll ${title} right`}
        >
          <IconChevronRight />
        </button>
      </div>
      {expandOpen ? (
        <div
          className="chat-model-rows__expand-panel"
          id={expandPanelId}
          role="region"
          aria-labelledby={seeAllBtnId}
        >
          <ul className="chat-model-rows__expand-grid">
            {models.map(model => (
              <li key={model.id} className="chat-model-rows__expand-cell">
                <ModelCarouselChip
                  model={model}
                  onPickModel={pickModel}
                  selected={selectedModelIds?.has(model.id) ?? false}
                  needsApiKey={modelPickRequiresApiKey}
                  guestDemoModelId={guestDemoModelId}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
