import type { CSSProperties } from 'react'
import type { SimpleIcon } from 'simple-icons'
import { ICON_VIEWBOX_OVERRIDES } from '../features/icons/chatgptIcon'
import {
  FALLBACK_MODEL_ICON,
  resolveSimpleIconForLlmProviderId,
  resolveSimpleIconForModelId,
} from '../features/icons/modelProviderIcon'

export type ProviderIconProps = {
  /** OpenRouter-style model id or bare id from upstream API */
  modelId?: string
  /** Backend from LLM provider dropdown - used when `modelId` omitted */
  llmProviderId?: string
  size?: number
  className?: string
  /** Override aria-label / tooltip (defaults to icon brand title) */
  title?: string
  /**
   * `brand` (default): Simple Icons hex fill.
   * `foreground`: `var(--text)` so glyphs stay visible on dark pills/circles (e.g. black X on xAI).
   * `secondary`: same ink as sidebar chrome (`var(--text-secondary)`).
   */
  tone?: 'brand' | 'foreground' | 'secondary'
}

function pickIcon(props: ProviderIconProps): SimpleIcon {
  if (props.modelId?.trim()) return resolveSimpleIconForModelId(props.modelId.trim())
  if (props.llmProviderId?.trim()) return resolveSimpleIconForLlmProviderId(props.llmProviderId.trim())
  return resolveSimpleIconForModelId('')
}

export function ProviderIcon(props: ProviderIconProps) {
  const { size = 18, className = '', title: titleOverride, tone = 'brand' } = props
  const icon = pickIcon(props)
  const title = titleOverride ?? icon.title
  const useSiteFallbackTint = icon.slug === FALLBACK_MODEL_ICON.slug
  const viewBox = ICON_VIEWBOX_OVERRIDES[icon.slug] ?? '0 0 24 24'
  const fillColor =
    tone === 'foreground'
      ? 'var(--text)'
      : tone === 'secondary'
        ? 'var(--text-secondary)'
        : useSiteFallbackTint
          ? 'var(--provider-icon-fallback)'
          : `#${icon.hex}`
  const style = {
    display: 'inline-block',
    flexShrink: 0,
    lineHeight: 0,
    verticalAlign: 'middle',
    color: fillColor,
  } satisfies CSSProperties

  return (
    <span className={`provider-icon ${className}`.trim()} style={style} title={title} role="img" aria-label={title}>
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        aria-hidden
        focusable="false"
      >
        <path fill="currentColor" d={icon.path} />
      </svg>
    </span>
  )
}
