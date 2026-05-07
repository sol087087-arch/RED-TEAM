/** Remove `(...)` and fullwidth `（…）` segments; repeat until stable. */
function stripParentheticalSegments(s: string): string {
  let t = s.trim()
  let prev = ''
  while (t !== prev) {
    prev = t
    t = t
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\（[^\）]*\）/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return t
}

/** Collapse consecutive duplicate tokens, case-insensitive (e.g. "DeepSeek DeepSeek V3" → "DeepSeek V3"). */
function collapseConsecutiveDuplicateWords(s: string): string {
  const parts = s.split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (const p of parts) {
    const low = p.toLowerCase()
    if (out.length && out[out.length - 1].toLowerCase() === low) continue
    out.push(p)
  }
  return out.join(' ')
}

/**
 * Short label for model chips: no parenthetical extras, no doubled leading brand words.
 */
export function simplifyModelDisplayName(raw: string): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return ''
  let t = stripParentheticalSegments(trimmed)
  t = collapseConsecutiveDuplicateWords(t)
  t = t.replace(/\s+/g, ' ').trim()
  return t.length > 0 ? t : trimmed
}
