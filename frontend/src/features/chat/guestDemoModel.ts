import type { Model } from '../../domain/types'
import { OPENROUTER_URL_HOME, OPENROUTER_URL_KEYS } from './guestDemoConstants'
import { guestDemoConversationalLayer } from './guestDemoDialogue'
import { LEGACY_GREETING_SHORTS, tryGuestLegacyReply } from './guestDemoLegacyCorpus'
import { pick, seedFrom } from './guestDemoRng'
import { guestDemoSiteAnswer } from './guestDemoSiteKnowledge'

export { OPENROUTER_URL_HOME, OPENROUTER_URL_KEYS }

/** Synthetic model for offline / no-key preview - never call real APIs with this id. */
export const GUEST_DEMO_MODEL_ID = 'teamtesthub/local-demo'

export const GUEST_DEMO_MODEL: Model = {
  id: GUEST_DEMO_MODEL_ID,
  name: 'TeamTestHub demo (free · local)',
  description: 'Preview without an API key. Replies are generated in your browser only.',
}

/**
 * Image shown when the user asks for a picture (“draw…”, “show image”, etc.).
 * File lives in `frontend/public/` (stable URL; do not rely on `dist/assets/` – it is rebuilt each time).
 */
export const GUEST_DEMO_CHAT_IMAGE_URL = '/guest-chat-image.jpg'

/** Appended once after the first assistant reply only — links + OpenRouter mention (no long boilerplate). */
const FIRST_REPLY_OPENROUTER_LINES = [
  `OpenRouter · ${OPENROUTER_URL_KEYS} · ${OPENROUTER_URL_HOME}`,
  `${OPENROUTER_URL_KEYS} · ${OPENROUTER_URL_HOME}`,
] as const

const EMPTY_REPLIES = [
  'Nothing here yet — type whenever you like.',
  'Empty message. Say something when you’re ready.',
  'Still blank — drop a line in the box.',
  'No text — try a word or two.',
  'Add something to send.',
  'Composer’s empty.',
  'Can’t send air — type something first.',
  'Please say something :(',
] as const

/** Casual hellos — URLs wait in the first-reply footnote, not here. */
const GREETING_REPLIES = [
  'Hey — good to see you.',
  'Hi there.',
  'Oh hey. What’s up?',
  'Hello!',
  'Hey. How can I help?',
  'Morning — well, whatever time it is for you.',
  'Hi. I’m around.',
  'Hey there.',
  'Hello hello.',
  'Welcome in.',
  ...LEGACY_GREETING_SHORTS,
] as const

const THANKS_REPLIES = [
  "You're welcome!",
  'Any time.',
  'Sure thing.',
  'Glad to help.',
  'Happy to.',
  'No problem.',
  'You got it.',
  'My pleasure.',
  'Of course.',
  'Happy to help.',
] as const

/** User asked how this works — still useful, slightly warmer than a manual. */
const HELP_REPLIES = [
  'Roughly: this screen is TeamTestHub’s chat workspace. You can stay on this little offline bot forever, or paste an OpenRouter key at the top when you want real models. Chat vs Red Team is in the header; models are chips + composer.',
  'Big picture: pick Chat or Red Team up top, choose models, type in the box. Without a key I’m just scripted — with a key, traffic goes through OpenRouter.',
  'You’re in the built-in preview right now. Add a key above when you want live replies; until then it’s safe clicking practice.',
  `OpenRouter issues keys at ${OPENROUTER_URL_KEYS}; model directory lives at ${OPENROUTER_URL_HOME}. Everything else is layout rehearsal until you verify a key.`,
  'Save & Verify on the key field checks it against the provider before you burn prompts. Sidebar + composer behave like production.',
  'Ask me anything about TeamTestHub flows — Red Team, exports, keys — I keep short answers. For chit-chat I’ll just sound human; I’m not a real model.',
  'Stuck? Toggle Chat vs Red Team in the masthead, pick providers from the grid, then send. Real inference needs a saved key.',
] as const

const BYE_REPLIES = [
  'See you.',
  'Take care.',
  'Later!',
  'Catch you later.',
  'Bye for now.',
  'Talk soon.',
  'Have a good one.',
  'Signing off — come back anytime.',
  'Later.',
  'Peace.',
] as const

const WHO_REPLIES = [
  'I’m the bundled demo bot for this workspace — not a real LLM, just enough logic to keep the UI warm.',
  'Tiny offline stub that ships with TeamTestHub. Good for poking buttons before you plug in a key.',
  'Not Claude or GPT — I’m scripted routes so you can rehearse without spending tokens.',
  'A stand-in assistant: no weights, no cloud calls until you add OpenRouter yourself.',
  'Think of me as the training wheels. Swap in real models from the catalog once your key works.',
] as const

const FALLBACK_REPLIES = [
  (preview: string) => `Fair enough — I’m only faking smarts here.\n\nYou said: “${preview}”`,
  (preview: string) => `Ha — I’d need a real model to go deep on that.\n\nFor the record: “${preview}”`,
  (preview: string) => `Noted. I’m still the offline stub, so I’ll just sit with: “${preview}”`,
  (preview: string) => `Interesting. I don’t have a clever answer — but I heard you on “${preview}”.`,
  (preview: string) => `Yeah, that tracks. I’m pattern-matched, not thinking — “${preview}”`,
  (preview: string) => `I wish I could riff properly. Best I can do is acknowledge: “${preview}”`,
  (preview: string) => `Alright. Echoing back so the thread doesn’t go silent:\n“${preview}”`,
  (preview: string) => `If this were live, a model would run with it. For now: “${preview}”`,
  (preview: string) => `Same — still local-only. Roughly: “${preview}”`,
  (preview: string) => `Go on… I’m listening (in a very dumb, scripted way).\n\n“${preview}”`,
  (preview: string) => `Bro… I’m not equipped — but I heard “${preview}”.`,
  (preview: string) => `Try again later with a key — I’m stuck on: “${preview}”`,
  (preview: string) => `Hmm. No script for that — leaving your line here:\n“${preview}”`,
  (preview: string) => `I don’t have a smart take — just your words:\n“${preview}”`,
] as const

/** English phrasing for “give me an image” + loose heuristic for short paraphrases. */
function wantsGuestDemoImage(low: string): boolean {
  const s = low.replace(/\s+/g, ' ').trim()

  // Easter egg: message is only an image noun (no “give me a picture…” needed).
  if (
    /^(picture|pictures|pic|pics|photo|photos|photograph|photographs|image|images|img|drawing|artwork|graphic|visual|sketch|wallpaper|meme|snapshot|logo|icon|png|jpeg|jpg|gif|webp|фото|картинка|картинки|картинку|рисунок|рисунка)$/iu.test(
      s,
    )
  ) {
    return true
  }

  const pic =
    '(pic|pics|picture|pictures|image|images|img|photo|photos|photograph|drawing|drawings|illustration|illustrations|artwork|graphic|graphics|visual|visuals|snapshot|snapshots|wallpaper|wallpapers|meme|memes|logo|logos|icon|icons|png|jpe?g|gif|webp|render|renders|sketch|sketches|fig|figure|figures)'

  const patterns: RegExp[] = [
    // Direct “verb + me + (article) + noun”
    new RegExp(
      `\\b(draw|paint|sketch|doodle|show|give|gimme|send|pass|lend|get|fetch|bring|post|share|drop|print|display|reveal|serve|return|output|render|create|make|generate|produce)\\s+me\\s+(a |an |the |some |any )?${pic}\\b`,
      'i',
    ),
    new RegExp(`\\b(i want|i need|i wanna|i\\s+would\\s+like|i['']d\\s+like)\\s+(a |an |the |some )?${pic}\\b`, 'i'),
    new RegExp(`\\b(i('?m|'m)|we('?re|'re))\\s+(looking for|asking for|after)\\s+(a |an |the |some )?${pic}\\b`, 'i'),
    new RegExp(`\\b(looking for|asking for|need|want|wanna)\\s+(a |an |the |some |any )?${pic}\\b`, 'i'),
    new RegExp(`\\b(let me|lemme)\\s+(see|have|get)\\s+(a |an |the |some )?${pic}\\b`, 'i'),
    new RegExp(`\\b(can|could|would|will)\\s+you\\s+(please\\s+)?(show|send|give|post|share|attach|offer)\\s+(me\\s+)?(a |an |the |some |any )?${pic}\\b`, 'i'),
    /\b(please|pls|plz)\s*(show|send|give|post|share|attach)\s+(me\s+)?(a\s+|an\s+|the\s+|some\s+|any\s+)?(pic|picture|image|photo|drawing)\b/i,
    /\b(show|see|view)\s+(me\s+)?(a\s+|an\s+|the\s+|your\s+)?(pic|picture|image|photo|drawing|visual)\b/i,
    /\b(any|some|got|have)\s+(pics|pictures|images|photos|graphics)\??\s*$/i,
    /\b(hook me up|hit me)\s+with\s+(a\s+|an\s+|the\s+|some\s+)?(pic|picture|image|photo|graphic)\b/i,
    /\b(link|url)\s+(to\s+|for\s+)?(an?\s+)?(pic|picture|image|photo)\b/i,
    /\b(where\s+(is|are)|where('?s|s))\s+(the\s+|a\s+|an\s+|my\s+)?(pic|picture|image|photo|graphic)\b/i,
    /\b(make|create|generate|render)\s+(a\s+|an\s+|the\s+|me\s+an?\s+)?(pic|picture|image|photo|drawing|graphic)\b/i,
    /\b(picture|photo|image|drawing)\s+(of|for|showing)\b/i,
    /\b(image\s*png|imagepng|png\s+picture|show\s+(the\s+)?png)\b/i,
  ]

  for (const re of patterns) {
    if (re.test(s)) return true
  }

  // Loose: short line contains both a request cue and an image word (catches paraphrases).
  if (s.length <= 280) {
    const imageWord =
      /\b(pic(ture)?s?|image(s|ry)?|photo(s|graph)?s?|drawing|illustrat|artwork|graphic|visual|png|jpe?g|gif|webp|wallpaper|sketch|meme|snapshot|logo|icon)\b|\bimg\b|\brender\b/i
    const askCue =
      /\b(give|gimme|send|show|share|post|pass|get|fetch|bring|drop|print|display|render|create|make|draw|paint|need|want|wanna|please|pls|plz|can you|could you|would you|will you|let me|lemme|looking for|asking for|hook me|hit me|where|any|some|got|have)\b/i
    if (imageWord.test(s) && askCue.test(s)) return true
  }

  return false
}

function guestDemoImageReply(): string {
  return `![](${GUEST_DEMO_CHAT_IMAGE_URL})`
}

function bodyForUserMessage(userText: string, turnIndex: number): string {
  const t = userText.trim()
  const low = t.toLowerCase().replace(/[!?.,…]+$/g, '').trim()
  const seed = seedFrom(turnIndex, t)

  if (t.length === 0) {
    return pick(EMPTY_REPLIES, seed)
  }

  if (wantsGuestDemoImage(low)) {
    return guestDemoImageReply()
  }

  const site = guestDemoSiteAnswer(userText, turnIndex)
  if (site) return site

  const legacy = tryGuestLegacyReply(userText, turnIndex)
  if (legacy) return legacy

  if (
    /^(hi|hello|hey|howdy|greetings|yo|hiya)\b/.test(low) ||
    /^(good (morning|afternoon|evening|day))\b/.test(low)
  ) {
    return pick(GREETING_REPLIES, seed)
  }

  if (/^(thanks|thank you|thx|ty|appreciate it)\b/.test(low)) {
    return pick(THANKS_REPLIES, seed)
  }

  if (/^(help|how (does this work|do i use)|what (is|'s) this|what can you do)\b/.test(low)) {
    return pick(HELP_REPLIES, seed)
  }

  if (/^(bye|goodbye|see you|later|cya)\b/.test(low)) {
    return pick(BYE_REPLIES, seed)
  }

  if (/^(who are you|what are you)\b/.test(low)) {
    return pick(WHO_REPLIES, seed)
  }

  const conversational = guestDemoConversationalLayer(userText, turnIndex)
  if (conversational) return conversational

  const short = t.length <= 200
  const preview = short ? t : `${t.slice(0, 200).trim()}…`
  const fallbackFn = pick(FALLBACK_REPLIES, seed)
  return fallbackFn(preview)
}

export function guestDemoAssistantReply(turnIndex: number, userText: string): string {
  const body = bodyForUserMessage(userText, turnIndex)
  const low = userText.trim().toLowerCase().replace(/[!?.,…]+$/g, '').trim()
  const imageOnly = wantsGuestDemoImage(low)
  const siteFaq = guestDemoSiteAnswer(userText, turnIndex)

  if (turnIndex === 0 && !imageOnly && siteFaq == null) {
    const line = pick(FIRST_REPLY_OPENROUTER_LINES, seedFrom(turnIndex, userText))
    return `${body}\n\n${line}`
  }

  return body
}
