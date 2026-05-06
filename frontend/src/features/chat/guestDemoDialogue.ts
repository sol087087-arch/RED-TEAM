/**
 * Light conversational layer for the offline demo (pattern-matched small talk).
 * Stays human-sounding; product/keys detail lives in guestDemoSiteKnowledge + first-reply footnote.
 */

import { pick, seedFrom, subSeed } from './guestDemoRng'

/** Conversational reply, or null to use default demo body. */
export function guestDemoConversationalLayer(userText: string, turnIndex: number): string | null {
  const t = userText.trim()
  if (t.length === 0) return null
  const low = t.toLowerCase()
  const seed = seedFrom(turnIndex, t)
  const rng = (n: number) => subSeed(seed, n) % 1000003

  const feel = t.match(/\b(i feel|i'm feeling|feeling)\b[\s,]+(.+)/i)
  if (feel && feel[2] && feel[2].trim().length > 2) {
    const topic = feel[2].trim().slice(0, 80)
    return pick(
      [
        `Sounds like “${topic}” is sitting with you. I’m not built to go deep — just holding space while you use the UI.`,
        `Yeah — “${topic}” is heavy enough that you’d want a real conversation for it. Here you’re basically rehearsing the layout.`,
        `Thanks for saying that about “${topic}”. I’m only mirroring tone so the thread feels alive.`,
        `Noted — “${topic}”. A proper model would stay with that longer than I can.`,
      ],
      rng(1),
    )
  }

  if (/\b(i am|i'm|i feel like)\s+/i.test(t) && t.length < 180) {
    return pick(
      [
        'That kind of line usually gets more context in a real chat — I’ll just nod along while you test the app.',
        'Fair. I can’t build on it the way a live model would, but the composer’s working.',
        'Self-descriptions are great for trying how the thread looks when you send something personal.',
      ],
      rng(2),
    )
  }

  if (/\bbecause\b/i.test(t)) {
    return pick(
      [
        '“Because” is doing a lot of work in that sentence — I’m following, in a mechanical way.',
        'That’s the part people usually want an answer to chain from. I’m not that chain, sadly.',
        'Causal little word. I’ll park it here until you have a real model on the other end.',
      ],
      rng(3),
    )
  }

  if (/\b(always|never|every time)\b/i.test(low)) {
    return pick(
      [
        'Strong words — they tend to show up when something’s stuck. I’m just the preview bot, but I read you.',
        'All-or-nothing language is a flag for humans and for models. I’m the cheap version of the latter.',
        'If you ever replay that with a live model, see how it softens or doubles down — fun compare.',
      ],
      rng(4),
    )
  }

  if (/\?$/.test(t) || /\b(why|how|what|who|when|where)\b/i.test(low)) {
    return pick(
      [
        'That’s a real question — I’d hand it to a real model. I can only do small talk in here.',
        'Good ask. I don’t have a proper answer, but the thread’s behaving, which is the point of the demo.',
        'If I were smart, I’d unpack that. Instead: your UI’s fine, I’m the weak link.',
        'I’d love to go step by step — that’s not in my script. Type away though; the layout’s the star.',
        'Question noted. Out of my depth, but the composer’s ready when you bring a key online.',
        'That’s the sort of thing you’d A/B across models — here you get me, one flavor only.',
      ],
      rng(5),
    )
  }

  if (/\b(code|python|javascript|typescript|function|bug|error)\b/i.test(low)) {
    return pick(
      [
        'Smells like a dev question — I can’t run or fix it, but you can use the same box for a real coding model later.',
        'I’d point that at something that can actually read a stack trace. I’m decoration.',
        'For repros and diffs, you’ll want live inference — I’m just keeping the chat warm.',
      ],
      rng(6),
    )
  }

  return null
}
