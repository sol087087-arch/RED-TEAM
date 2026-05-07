import type { CSSProperties } from 'react'

function hashStringToUInt(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}

/** Single-hue diagonal sheen (picker chips); angle fixed to match existing UI. */
function modelSheenGradientForKey(key: string): string {
  const h = hashStringToUInt(key)
  const hue = h % 360
  const s = 72 + (h % 14) /* 72-85% */
  const l = 52 + (h % 12) /* 52-63% - reads clearly under ~0.2 alpha */
  return `linear-gradient(45deg, transparent 0%, hsla(${hue}, ${s}%, ${l}%, 0.2) 100%)`
}

/**
 * One hue per model (spread across the rainbow by hashing `modelId`), not a multi-color ramp.
 * Hover sheen: 45° fade from full transparency → that hue at 20% opacity (more saturated mid-tones).
 */
export function modelChipSheenStyle(modelId: string): CSSProperties {
  return { ['--model-chip-sheen' as string]: modelSheenGradientForKey(modelId) }
}

/**
 * Same color math as model chips, but each stable `actionKey` gets its own hue; gradient angle
 * varies slightly so header / thread controls feel distinct from the carousel.
 */
export function chatOrbSheenGradientForKey(actionKey: string): string {
  const h = hashStringToUInt(actionKey)
  const hue = h % 360
  const s = 72 + (h % 14)
  const l = 52 + (h % 12)
  const angle = 34 + (h % 28) /* 34-61deg */
  return `linear-gradient(${angle}deg, transparent 0%, hsla(${hue}, ${s}%, ${l}%, 0.22) 100%)`
}

export function chatOrbSheenStyle(actionKey: string): CSSProperties {
  return { ['--chat-orb-sheen' as string]: chatOrbSheenGradientForKey(actionKey) }
}
