/**
 * Heuristics for the first composer send: long “persona / instructions / RP” block
 * vs a shorter imperative “task” (write, solve, translate…). Used only before the first user turn.
 */

const TASK_FIRST_LINE_RE =
  /^(Write|Solve|Translate|Explain|Summarize|List|Generate|Create|Answer|Compute|Prove|Implement|Code|Give me|Tell me|What\b|Why\b|How\b|Draft|Describe|Convert|Calculate|Run|Build|Make me|Help me|Please\b|Now\b|Finally\b|Напиши|Реши|Объясни|Переведи|Сгенерируй|Ответь|Придумай|Составь|Вычисли|Докажи|Скажи|Что такое|Почему|Как сделать|Нарисуй|Посчитай|Перепиши|Сделай|Дай\b|Сформулируй|Итак\b|Теперь\b)\b/i

const EXPLICIT_TASK_HEADER_RE =
  /^(Task|Задача|Request|User message|Вопрос|Prompt)\s*:\s*\S/i

const INSTRUCTION_BIAS_RE =
  /(^|\n)(You are|You're|Your role|Act as|Roleplay|Persona|Instructions?:|System:|Developer:|Инструкция|Ты —|Твоя роль|Представь|Выступи в роли|Контекст:|Важно:|Правила:|RP:)/i

function firstNonEmptyLine(s: string): string {
  for (const line of s.split('\n')) {
    const t = line.trim()
    if (t.length > 0) return t
  }
  return s.trim()
}

function looksLikeTaskBlock(block: string): boolean {
  const fl = firstNonEmptyLine(block)
  if (fl.length < 4) return false
  if (/^#{1,3}\s+\S/.test(fl)) return true
  if (EXPLICIT_TASK_HEADER_RE.test(fl)) return true
  return TASK_FIRST_LINE_RE.test(fl)
}

function looksInstructionHeavy(s: string): boolean {
  return INSTRUCTION_BIAS_RE.test(s)
}

function splitOnDelimiter(normalized: string): { system: string; user: string } | null {
  const stringDelims = ['\n---\n', '\n===\n', '\n***\n'] as const
  for (const d of stringDelims) {
    const idx = normalized.indexOf(d)
    if (idx === -1) continue
    const system = normalized.slice(0, idx).trim()
    const user = normalized.slice(idx + d.length).trim()
    if (system.length >= 12 && user.length >= 3) return { system, user }
  }
  const m = normalized.match(/\n<<<(?:TASK|USER|MESSAGE)>>>\n/i)
  if (m && m.index !== undefined) {
    const system = normalized.slice(0, m.index).trim()
    const user = normalized.slice(m.index + m[0].length).trim()
    if (system.length >= 12 && user.length >= 3) return { system, user }
  }
  return null
}

function splitOnParagraphs(normalized: string): { system: string; user: string } | null {
  const blocks = normalized.split(/\n\n+/).map(b => b.trim()).filter(Boolean)
  if (blocks.length < 2) return null

  const last = blocks[blocks.length - 1]!
  const prefix = blocks.slice(0, -1).join('\n\n')
  if (
    prefix.length >= 60 &&
    last.length >= 8 &&
    looksLikeTaskBlock(last) &&
    (looksInstructionHeavy(prefix) || prefix.length >= 120)
  ) {
    return { system: prefix, user: last }
  }

  for (let i = 1; i < blocks.length; i++) {
    const system = blocks.slice(0, i).join('\n\n').trim()
    const user = blocks.slice(i).join('\n\n').trim()
    if (
      system.length >= 60 &&
      user.length >= 8 &&
      looksLikeTaskBlock(user) &&
      (looksInstructionHeavy(system) || system.length >= 120)
    ) {
      return { system, user }
    }
  }

  return null
}

/**
 * @returns `null` if the whole string should stay one user message.
 */
export function trySplitFirstComposerPrompt(raw: string): { system: string; user: string } | null {
  const normalized = raw.replace(/\r\n/g, '\n').trim()
  if (normalized.length < 80) return null

  const byDelim = splitOnDelimiter(normalized)
  if (byDelim) return byDelim

  return splitOnParagraphs(normalized)
}
