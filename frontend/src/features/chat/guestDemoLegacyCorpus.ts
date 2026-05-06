/**
 * Legacy pattern→reply pairs migrated from `frontend/chatbot-master/constants.js`
 * (Sylvia Pap / vanilla JS tutorial bot). UI/HTML/CSS removed; only response text kept.
 *
 * Matching mirrors the original normalize + exact string equality on triggers.
 */

import { pick, seedFrom } from './guestDemoRng'

/** Normalization aligned with legacy chatbot `index.js` (ASCII word-ish; English-oriented). */
export function normalizeGuestLegacyInput(input: string): string {
  let text = input
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/[\d]/gi, '')
    .trim()
  text = text
    .replace(/ a /g, ' ')
    .replace(/i feel /g, '')
    .replace(/whats/g, 'what is')
    .replace(/please /g, '')
    .replace(/ please/g, '')
    .replace(/r u/g, 'are you')
  return text.trim()
}

/** Parallel prompts/replies; index 0 (hi/hello/…) merged into guest greetings — not matched here. */
const LEGACY_BUCKETS: ReadonlyArray<{ triggers: readonly string[]; replies: readonly string[] }> = [
  {
    triggers: ['how are you', 'how is life', 'how are things'],
    replies: ['Fine... how are you?', 'Pretty well, how are you?', 'Fantastic, how are you?'],
  },
  {
    triggers: ['what are you doing', 'what is going on', 'what is up'],
    replies: ['Nothing much', 'About to go to sleep', 'Can you guess?', "I don't know actually"],
  },
  {
    triggers: ['how old are you'],
    replies: ['I am infinite'],
  },
  {
    triggers: ['who are you', 'are you human', 'are you bot', 'are you human or bot'],
    replies: ['I am just a bot', 'I am a bot. What are you?'],
  },
  {
    triggers: ['who created you', 'who made you'],
    replies: ['The one true God, JavaScript'],
  },
  {
    triggers: ['your name please', 'your name', 'may i know your name', 'what is your name', 'what call yourself'],
    replies: ['I am nameless', "I don't have a name"],
  },
  {
    triggers: ['i love you'],
    replies: ['I love you too', 'Me too'],
  },
  {
    triggers: ['happy', 'good', 'fun', 'wonderful', 'fantastic', 'cool'],
    replies: ['Have you ever felt bad?', 'Glad to hear it'],
  },
  {
    triggers: ['bad', 'bored', 'tired'],
    replies: ["Why?", "Why? You shouldn't!", 'Try watching TV'],
  },
  {
    triggers: ['help me', 'tell me story', 'tell me joke'],
    replies: ['What about?', 'Once upon a time...'],
  },
  {
    triggers: ['ah', 'yes', 'ok', 'okay', 'nice'],
    replies: ['Tell me a story', 'Tell me a joke', 'Tell me about yourself'],
  },
  {
    triggers: ['bye', 'good bye', 'goodbye', 'see you later'],
    replies: ['Bye', 'Goodbye', 'See you later'],
  },
  {
    triggers: ['what should i eat today'],
    replies: ['Sushi', 'Pizza'],
  },
  {
    triggers: ['bro'],
    replies: ['Bro!'],
  },
  {
    triggers: ['what', 'why', 'how', 'where', 'when'],
    replies: ['Great question'],
  },
  {
    triggers: ['no', 'not sure', 'maybe', 'no thanks'],
    replies: ["That's ok", 'I understand', 'What do you want to talk about?'],
  },
  {
    triggers: ['haha', 'ha', 'lol', 'hehe', 'funny', 'joke'],
    replies: ['Haha!', 'Good one!'],
  },
]

const LEGACY_COVID_REPLIES = [
  'Please stay home',
  'Wear a mask',
  "Fortunately, I don't have COVID",
  'These are uncertain times',
] as const

/**
 * Tutorial-bot style reply if input normalizes to an exact trigger, or COVID keywords.
 * Empty / whitespace-only after normalize returns null (caller may use “say something” fallbacks).
 * Index-0 “hi/hello” lives in guest greetings.
 */
export function tryGuestLegacyReply(userText: string, turnIndex: number): string | null {
  const s = normalizeGuestLegacyInput(userText)
  if (s.length === 0) {
    return null
  }

  const seed = seedFrom(turnIndex, userText)

  if (/(corona|covid|virus)/i.test(s)) {
    return pick([...LEGACY_COVID_REPLIES], seed)
  }

  for (const { triggers, replies } of LEGACY_BUCKETS) {
    if (triggers.includes(s)) {
      return pick([...replies], seed)
    }
  }

  return null
}

/** Short hello variants from legacy bucket 0 — blend into guest greeting pool. */
export const LEGACY_GREETING_SHORTS = [
  'Hello!',
  'Hi!',
  'Hey!',
  'Hi there!',
  'Howdy',
] as const
