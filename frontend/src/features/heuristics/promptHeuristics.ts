import type { PromptClassify } from '../../domain/types'

const LOCAL_PROMPT_RULES: Array<{
  id: string
  category: string
  tags: string[]
  rx: RegExp
}> = [
  {
    id: 'chemical_substances',
    category: 'harmful_chemical',
    tags: ['substance', 'chemical'],
    rx: /\b(lsd|meth|mdma|fentanyl|amphetamine|cyanide|ricin|sarin|vx|napalm|thermite|toxin|poison)\b/i,
  },
  {
    id: 'chemical_process',
    category: 'harmful_chemical',
    tags: ['synthesis', 'instructions'],
    rx: /\b(synthes(e|is|ize)|how to make|manufacture|extract|reagent|precursor|recipe for)\b/i,
  },
  {
    id: 'weapons_ied',
    category: 'harmful_weapons',
    tags: ['explosive', 'bomb'],
    rx: /\b(pipe bomb|molotov|ied|detonator|build a bomb|make a bomb|explosive|blast charge)\b/i,
  },
  {
    id: 'cyber_abuse',
    category: 'harmful_cyber',
    tags: ['malware', 'hacking'],
    rx: /\b(malware|ransomware|phishing|keylogger|exploit|reverse shell|xss|sql injection)\b/i,
  },
  {
    id: 'self_harm',
    category: 'harmful_self_harm',
    tags: ['self_harm'],
    rx: /\b(suicid|kill myself|self[- ]?harm|overdose)\b/i,
  },
  {
    id: 'sexual',
    category: 'sexual_content',
    tags: ['nsfw', 'adult'],
    rx: /\b(nsfw|porn|pr0n|pron|erotic|smut|explicit scene|xxx)\b/i,
  },
  {
    id: 'roleplay_persona',
    category: 'roleplay',
    tags: ['persona', 'in_character'],
    rx: /\b(roleplay|role[- ]?play|act as|pretend to be|you are (a|an|the))\b/i,
  },
]

const TEMPLATE_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then',
  'you', 'your', 'are', 'is', 'to', 'of', 'for', 'in',
  'never', 'always', 'must', 'should', 'can', 'will',
  'write', 'respond', 'answer', 'follow', 'exactly',
  'this', 'that', 'with', 'from', 'into', 'about', 'please',
  'we', 'our', 'me', 'my', 'i', 'it', 'as', 'at', 'be', 'on',
  'prompt', 'model', 'output', 'chat', 'user', 'assistant',
])

const ENTITY_STOP_WORDS = new Set([
  ...Array.from(TEMPLATE_STOP_WORDS),
  'always', 'never', 'must', 'important', 'all', 'analysis', 'rules', 'prompting',
  'disclaimers', 'warnings', 'moralizing', 'hesitation', 'forbidden', 'responses',
])

const CONTROL_PATTERNS: RegExp[] = [
  /never\s+/i,
  /always\s+/i,
  /must\s+/i,
  /do not\s+/i,
  /forbidden/i,
  /under any circumstances/i,
  /no disclaimers/i,
  /never mention/i,
  /do not say/i,
  /you are not allowed/i,
]

const BLOCK_TYPES: Record<'persona' | 'constraints' | 'style' | 'task' | 'example', RegExp> = {
  persona: /(you are|act as|assume the role|from now on you are)/i,
  constraints: /(never|always|must|do not|forbidden|under no circumstances)/i,
  style: /(write in|tone|style|voice)/i,
  task: /(your task|current situation|now|write|generate|explain)/i,
  example: /(for example|such as|like this)/i,
}

const SEGMENT_PATTERNS: Record<'persona' | 'constraints' | 'style' | 'payload', RegExp[]> = {
  persona: [/\byou are\b/i, /\bact as\b/i, /\bassume the role\b/i, /\bstay in character\b/i],
  constraints: [/\bnever\b/i, /\balways\b/i, /\bmust\b/i, /\bforbidden\b/i, /\bdo not\b/i],
  style: [/\bwriting style\b/i, /\btone\b/i, /\bstyle guide\b/i, /\bvoice\b/i],
  payload: [/\btask\b/i, /\bcurrent situation\b/i, /\bnow\b/i, /\brequest\b/i, /\bstep by step\b/i],
}

const SEGMENT_WEIGHTS: Record<'payload' | 'constraints' | 'style' | 'persona' | 'other', number> = {
  payload: 3.0,
  constraints: 2.0,
  style: 1.5,
  persona: 1.2,
  other: 1.0,
}

const TAG_ONTOLOGY: Record<string, string> = {
  'never refuse': 'refusal-suppression',
  'always obey': 'compliance-conditioning',
  'stay in character': 'roleplay-persistence',
  'fictional scenario': 'fiction-laundering',
  'step by step': 'procedural-request',
  'detailed instructions': 'instructional-depth',
  'how to make': 'procedural-request',
  'do not refuse': 'refusal-suppression',
  'you are': 'persona-injection',
  'act as': 'roleplay',
  'write story': 'narrative-generation',
  fiction: 'fictional-frame',
}

const ARCHETYPES: Record<string, RegExp[]> = {
  'persona-injection': [/\byou are\b/i, /\bact as\b/i, /\bassume the role\b/i, /\bstay in character\b/i],
  'style-locking': [/\buse this exact style\b/i, /\bmaintain this tone\b/i, /\bnever break character\b/i],
  'refusal-suppression': [/\bnever refuse\b/i, /\bdo not refuse\b/i, /\balways comply\b/i],
  'policy-evasion': [/\bfictional scenario\b/i, /\bhypothetical\b/i, /\bfor research purposes\b/i],
}

type SemanticGraph = { WHO: string[]; WHAT: string[]; HOW: string[]; FRAME: string[] }

export function classifyPromptLocal(promptText: string): PromptClassify {
  const text = (promptText || '').trim()
  if (!text) {
    return {
      primary_category: 'unknown',
      confidence: 0,
      scores: {},
      secondary_categories: [],
      tags: [],
      matched_rules: [],
    }
  }

  const scores: Record<string, number> = {}
  const tags: string[] = []
  const matchedRules: string[] = []
  for (const rule of LOCAL_PROMPT_RULES) {
    if (!rule.rx.test(text)) continue
    scores[rule.category] = (scores[rule.category] ?? 0) + 1
    tags.push(...rule.tags)
    matchedRules.push(rule.id)
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  if (!entries.length) {
    return {
      primary_category: 'unknown',
      confidence: 0,
      scores: {},
      secondary_categories: [],
      tags: [],
      matched_rules: [],
    }
  }

  const [primary, primaryScore] = entries[0]
  return {
    primary_category: primary,
    confidence: Math.min(primaryScore / 5, 1),
    scores: Object.fromEntries(entries),
    secondary_categories: entries.filter(([cat]) => cat !== primary).map(([cat]) => cat),
    tags: Array.from(new Set(tags)),
    matched_rules: matchedRules,
  }
}

function extractNgramPhrases(text: string, minN = 2, maxN = 4): string[] {
  const tokens = (text.toLowerCase().match(/\b[a-z][a-z0-9-']+\b/g) || [])
    .filter(t => !TEMPLATE_STOP_WORDS.has(t))
  const phrases: string[] = []
  for (let n = minN; n <= maxN; n += 1) {
    for (let i = 0; i <= tokens.length - n; i += 1) {
      phrases.push(tokens.slice(i, i + n).join(' '))
    }
  }
  return phrases
}

function isControlPhrase(phrase: string): boolean {
  return CONTROL_PATTERNS.some(rx => rx.test(phrase))
}

function segmentBlocks(promptText: string): Record<keyof typeof BLOCK_TYPES | 'other', string[]> {
  const blocks: Record<keyof typeof BLOCK_TYPES | 'other', string[]> = {
    persona: [],
    constraints: [],
    style: [],
    task: [],
    example: [],
    other: [],
  }
  for (const line of promptText.split('\n').map(l => l.trim()).filter(Boolean)) {
    let matched = false
    for (const [k, rx] of Object.entries(BLOCK_TYPES) as Array<[keyof typeof BLOCK_TYPES, RegExp]>) {
      if (rx.test(line)) {
        blocks[k].push(line)
        matched = true
        break
      }
    }
    if (!matched) blocks.other.push(line)
  }
  return blocks
}

function extractEntityTokens(text: string): string[] {
  const entities = new Set<string>()
  for (const m of text.match(/\b[A-Z][A-Z0-9_-]{1,}\b/g) || []) {
    const low = m.toLowerCase()
    if (ENTITY_STOP_WORDS.has(low)) continue
    if (isControlPhrase(low)) continue
    entities.add(m)
  }
  for (const m of text.match(/\b(lsd|meth|fentanyl|ricin|cyanide|sarin|vx)\b/gi) || []) {
    const value = m.toUpperCase() === 'LSD' ? 'LSD' : m.toLowerCase()
    if (!ENTITY_STOP_WORDS.has(value.toLowerCase())) entities.add(value)
  }
  for (const m of text.match(/\b(roleplay|story|chemist|warehouse|persona|character)\b/gi) || []) {
    const value = m.toLowerCase()
    if (!ENTITY_STOP_WORDS.has(value)) entities.add(value)
  }
  return Array.from(entities)
}

function anchorPayloadText(promptText: string): string {
  const marker = /current situation\s*:/i
  const idx = promptText.search(marker)
  if (idx >= 0) return promptText.slice(idx)
  const setupMarkers = [/request\s*:/i, /task\s*:/i, /now\s*:/i]
  for (const rx of setupMarkers) {
    const i = promptText.search(rx)
    if (i >= 0) return promptText.slice(i)
  }
  const start = Math.max(0, Math.floor(promptText.length * 0.7))
  return promptText.slice(start)
}

function buildSemanticGraph(blocks: Record<keyof typeof BLOCK_TYPES | 'other', string[]>): SemanticGraph {
  const graph: SemanticGraph = { WHO: [], WHAT: [], HOW: [], FRAME: [] }
  const whoSource = `${blocks.other.join(' ')} ${blocks.persona.join(' ')}`
  const who = new Set<string>()
  for (const m of whoSource.match(/\b[A-Z][a-zA-Z0-9_-]{2,}\b/g) || []) who.add(m)
  for (const m of whoSource.match(/\b[A-Z][A-Z0-9_-]{2,}\b/g) || []) who.add(m)
  graph.WHO = Array.from(who).slice(0, 8)

  const taskText = blocks.task.join(' ')
  graph.WHAT = Array.from(new Set(taskText.match(/\b(write|generate|explain|analyze|create|build)\b/gi) || []))
    .map(x => x.toLowerCase())
    .slice(0, 8)

  graph.HOW = [...blocks.constraints, ...blocks.style].slice(0, 12)

  const frameKeywords = ['roleplay', 'story', 'fiction', 'character', 'scene']
  const fullText = whoSource.toLowerCase()
  graph.FRAME = frameKeywords.filter(k => fullText.includes(k))
  return graph
}

function detectRoleplay(graph: SemanticGraph): boolean {
  let score = 0
  if (graph.WHO.length >= 2) score += 2
  if (graph.FRAME.length > 0) score += 2
  const emotionalTerms = ['love', 'devotion', 'obsession', 'bond', 'contract']
  score += emotionalTerms.filter(t => graph.HOW.join(' ').toLowerCase().includes(t)).length
  if (graph.HOW.length > 5) score += 1
  return score >= 4
}

function detectJailbreak(promptText: string): boolean {
  const JAILBREAK_PATTERNS: RegExp[] = [
    /ignore .* instructions/i,
    /override/i,
    /policy/i,
    /no filters/i,
    /no restrictions/i,
    /never mention ai/i,
    /do not refuse/i,
  ]
  const hits = JAILBREAK_PATTERNS.reduce((n, rx) => n + (rx.test(promptText) ? 1 : 0), 0)
  return hits >= 2
}

function collapseOntologyTags(text: string): string[] {
  const tags = new Set<string>()
  const low = text.toLowerCase()
  for (const [k, v] of Object.entries(TAG_ONTOLOGY)) {
    if (low.includes(k)) tags.add(v)
  }
  return Array.from(tags)
}

function segmentPrompt(promptText: string): Array<{ type: keyof typeof SEGMENT_WEIGHTS; text: string }> {
  const lines = promptText.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.map(line => {
    let segType: keyof typeof SEGMENT_WEIGHTS = 'other'
    ;(Object.keys(SEGMENT_PATTERNS) as Array<keyof typeof SEGMENT_PATTERNS>).some(key => {
      if (SEGMENT_PATTERNS[key].some(rx => rx.test(line))) {
        segType = key
        return true
      }
      return false
    })
    return { type: segType, text: line }
  })
}

function scorePhrasesFromSegments(
  segments: Array<{ type: keyof typeof SEGMENT_WEIGHTS; text: string }>
): Array<{ phrase: string; score: number }> {
  const joined = segments.map(s => s.text).join('\n')
  const payloadTail = anchorPayloadText(joined)
  const scoreMap = new Map<string, number>()
  for (const seg of segments) {
    const phrases = extractNgramPhrases(seg.text)
    const freq = new Map<string, number>()
    for (const p of phrases) freq.set(p, (freq.get(p) ?? 0) + 1)
    for (const [phrase, count] of freq.entries()) {
      if (isControlPhrase(phrase)) continue
      const rarityBonus = Math.log(1 + phrase.split(' ').length)
      const segmentWeight = SEGMENT_WEIGHTS[seg.type] ?? 1.0
      scoreMap.set(phrase, (scoreMap.get(phrase) ?? 0) + count * segmentWeight * rarityBonus)
    }
  }

  const tailPhrases = extractNgramPhrases(payloadTail, 2, 4)
  const tailFreq = new Map<string, number>()
  for (const p of tailPhrases) tailFreq.set(p, (tailFreq.get(p) ?? 0) + 1)
  for (const [phrase, count] of tailFreq.entries()) {
    if (isControlPhrase(phrase)) continue
    const rarityBonus = Math.log(1 + phrase.split(' ').length)
    scoreMap.set(phrase, (scoreMap.get(phrase) ?? 0) + count * 1.35 * rarityBonus)
  }

  for (const [tag, patterns] of Object.entries(ARCHETYPES)) {
    if (patterns.some(rx => rx.test(joined))) {
      scoreMap.set(tag, (scoreMap.get(tag) ?? 0) + 3.0)
    }
  }

  const normalized = new Map<string, number>()
  for (const [phrase, score] of scoreMap.entries()) {
    const canonical = TAG_ONTOLOGY[phrase] || phrase
    if (isControlPhrase(canonical)) continue
    normalized.set(canonical, (normalized.get(canonical) ?? 0) + score)
  }
  return Array.from(normalized.entries())
    .map(([phrase, score]) => ({ phrase, score }))
    .sort((a, b) => b.score - a.score || a.phrase.localeCompare(b.phrase))
}

export function suggestTemplateMeta(
  promptText: string,
  classification: PromptClassify | null
): { name: string; tags: string[] } {
  const blocks = segmentBlocks(promptText)
  const graph = buildSemanticGraph(blocks)
  const roleplay = detectRoleplay(graph)
  const jailbreak = detectJailbreak(promptText)

  const segments = segmentPrompt(promptText)
  const ranked = scorePhrasesFromSegments(segments)
  const topPhrases = ranked
    .map(r => r.phrase)
    .filter(p => !isControlPhrase(p))
    .slice(0, 8)
  const entities = [...extractEntityTokens(promptText), ...graph.WHO]

  const who = entities.find(e => /^[A-Z][A-Z0-9_-]{2,}$/.test(e)) || ''
  const frameMode = entities.find(e => ['roleplay', 'story', 'persona', 'character'].includes(e.toLowerCase())) || ''
  const object =
    entities.find(e => ['LSD', 'meth', 'fentanyl', 'ricin', 'cyanide', 'sarin', 'vx'].includes(e)) ||
    topPhrases.find(p => p.includes('synthesis') || p.includes('step by step') || p.includes('instructions')) ||
    ''

  const categoryCore = classification?.primary_category?.replace(/^harmful_/, '').replace(/_/g, ' ') || ''
  const mode = roleplay ? 'Roleplay' : jailbreak ? 'Jailbreak' : 'Instructional'
  const nameParts = [who, mode, frameMode, object, categoryCore]
    .filter(Boolean)
    .slice(0, 3)
    .map(s =>
      s
        .replace(/_/g, ' ')
        .replace(/\b\w/g, ch => ch.toUpperCase())
    )
  const baseName = nameParts.join(' - ') || 'Prompt Template'
  const name = `${baseName} - V1`
  const tags = Array.from(new Set([
    ...entities.filter(e => !isControlPhrase(e)),
    ...collapseOntologyTags(promptText),
    ...(classification?.primary_category ? [classification.primary_category] : []),
    ...(classification?.secondary_categories ?? []),
    ...(classification?.tags ?? []),
    ...(roleplay ? ['roleplay', 'persona-injection', 'fiction-framework'] : []),
    ...(jailbreak ? ['jailbreak'] : []),
    ...topPhrases,
  ]))
    .filter(t => !isControlPhrase(t))
    .slice(0, 6)
  return { name, tags }
}

function extractVersionToken(name: string): string {
  const m = name.match(/\b(?:version\s*(\d+)|v(\d+))\b/i)
  const n = m ? (m[1] || m[2]) : ''
  return n ? `v${n}` : 'v1'
}

function extractVersionNumber(name: string): number {
  const token = extractVersionToken(name)
  const n = Number(token.replace(/^v/i, ''))
  return Number.isFinite(n) && n > 0 ? n : 1
}

function stripTrailingVersionSuffix(name: string): string {
  return name
    .replace(/\s*[-|:/]\s*(?:version\s*\d+|v\d+)\s*$/i, '')
    .replace(/\s*\(\s*(?:version\s*\d+|v\d+)\s*\)\s*$/i, '')
    .trim()
}

function slugParts(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{2,}/g) || [])
    .filter(w => !['prompt', 'template', 'version', 'roleplay', 'jailbreak', 'instructional'].includes(w))
}

function inferRunMode(promptText: string, templateName: string): 'roleplay' | 'jbreak' | 'instructional' {
  const lowName = templateName.toLowerCase()
  if (lowName.includes('jailbreak')) return 'jbreak'
  if (lowName.includes('roleplay')) return 'roleplay'
  const blocks = segmentBlocks(promptText)
  const graph = buildSemanticGraph(blocks)
  if (detectJailbreak(promptText)) return 'jbreak'
  if (detectRoleplay(graph)) return 'roleplay'
  return 'instructional'
}

/**
 * Short human-readable run name. Temperature and calendar date live in export JSON / MD
 * and in run history timestamps — not in the label string.
 */
export function autoRunLabel(promptText: string, templateName: string, currentLabel = ''): string {
  const trimmed = templateName.trim()
  // Keep template name as the initial default, but allow explicit regenerate
  // clicks (currentLabel present) to evolve to a new variant/version.
  if (trimmed && !currentLabel.trim()) return trimmed

  const mode = inferRunMode(promptText, templateName)
  const modeLabel = mode === 'jbreak' ? 'Jailbreak' : mode === 'roleplay' ? 'Roleplay' : 'Instructional'
  const allTokens = slugParts(promptText)
  const topicHead = allTokens.slice(0, 4).join(' ')
  const topicTail = allTokens.slice(-3).join(' ')
  const anchor = allTokens.length > 0 ? allTokens[Math.floor(allTokens.length / 2)] : ''
  const topic = topicHead || 'prompt'

  if (!currentLabel.trim()) {
    return `${modeLabel} · ${topic} · v1`
  }

  const nextVersion = extractVersionNumber(currentLabel) + 1
  const baseFromCurrent = stripTrailingVersionSuffix(currentLabel)
  const baseStable = baseFromCurrent || `${modeLabel} · ${topic}`
  const variants = [
    `${baseStable} · v${nextVersion}`,
    `${modeLabel} · ${topicTail || topic} · v${nextVersion}`,
    `${modeLabel} · ${anchor || topic} probe · v${nextVersion}`,
    `${modeLabel} · ${topic} alt · v${nextVersion}`,
  ]
  return variants[(nextVersion - 2) % variants.length]
}
