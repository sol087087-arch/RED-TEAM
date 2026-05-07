/**
 * TeamTestHub product Q&A for the offline demo bot (no network).
 * Matched before generic chit-chat so “how do I … on this site?” routes here.
 */

import { OPENROUTER_URL_HOME, OPENROUTER_URL_KEYS } from './guestDemoConstants'
import { pick, seedFrom, subSeed } from './guestDemoRng'

export function guestDemoSiteAnswer(userText: string, turnIndex: number): string | null {
  const t = userText.trim()
  if (t.length === 0) return null
  const low = t.toLowerCase()
  const seed = seedFrom(turnIndex, t)
  const s = (n: number) => subSeed(seed, n)

  const aboutProduct =
    /\b(teamtesthub|team test hub|this (app|site|tool|product|page)|what (is|does)|what'?s (this|here))\b/i.test(
      t,
    ) || /\b(purpose|overview|describe)\b.*\b(site|app|tool)\b/i.test(low)

  if (aboutProduct) {
    return pick(
      [
        'TeamTestHub is a browser workspace for parallel LLM testing and multi-model chat, wired through OpenRouter. You can blast one prompt to many models (Red Team style) or carry on a chat - keys stay in your session until you refresh (unless you run high-privacy mode elsewhere).',
        'This app lets you compare models side by side on the same prompt and chat with one or more models. Everything routes via OpenRouter once you paste an API key; without a key you are in this local demo that only exercises the UI.',
        'Think of it as a control room: pick providers and models, send prompts, watch replies stream in, export runs - for red-team style evaluation and everyday chat. Live inference needs your OpenRouter key in the field above.',
        `It is a static front end that speaks OpenRouter’s OpenAI-shaped API: browse models at ${OPENROUTER_URL_HOME}, compare locally here, then paste a key when you want real tokens.`,
        'Rough mental model: spreadsheet for prompts - same row goes to every column (model). Swap between Chat threads and Red Team batches from the masthead tabs.',
        'No server-side “TeamTestHub brain” is required for the default build; the demo conversation you see now is bundled logic so you can learn the UI offline.',
      ],
      s(1),
    )
  }

  if (
    /\b(red team|redteam|parallel|batch (run|test)|multiple models at once|same prompt.*models)\b/i.test(
      t,
    )
  ) {
    return pick(
      [
        'Red Team mode is for parallel runs: one prompt goes to every selected model so you can compare refusals, tone, and latency. Switch modes from the Chat vs Red Team control in the header (masthead tabs). After you add a key, pick models in the run setup and run your test flow.',
        'Use Red Team when you want a shotgun comparison - not a single chat thread. Toggle Red Team vs Chat in the masthead; Red Team focuses on batch evaluation and exports.',
        'Parallel blast is the headline feature: one send, N model outputs, easy diffing. Chat mode is better when you care about turn-taking and a single narrative.',
        'Latency and refusal patterns jump out when every reply lands at once - that is the workflow Red Team optimizes for.',
      ],
      s(2),
    )
  }

  if (
    /\b(chat mode|switch (to )?chat|only chat|multi-?model chat|conversation mode)\b/i.test(t) ||
    /\bhow (do i|to) (open|use|get to) chat\b/i.test(low)
  ) {
    return pick(
      [
        'Chat mode is the conversational layout you are in now: sidebar, composer, model chips. Flip from Red Team to Chat using the segmented tabs next to the workspace title in the masthead - same key, different workflow.',
        'To stay in chat: choose Chat on the mode switch (vs Red Team). Then select models from the grid or Explore shortcuts and write in the composer - responses fan out per model.',
        'Chat keeps one thread surface per workspace slice - good for rehearsals, copy edits, and role-play style evals before you scale to big Red Team sweeps.',
        'If the UI feels “chatty” with toolbars and a composer dock, you are in Chat; Red Team opens a more grid-like run console.',
      ],
      s(3),
    )
  }

  if (
    /\b(where|how) (do i|to|can i) (switch|toggle|change).*\b(red team|chat)\b/i.test(low) ||
    /\b(mode|switch).*\b(red team|chat)\b/i.test(low)
  ) {
    return pick(
      [
        'Look for the Chat vs Red Team toggle in the top masthead (pill tabs). That switches the whole workspace mode - not buried in settings.',
        'The mode switch sits in the header strip: Chat for threads like this, Red Team for parallel evaluation screens.',
      ],
      s(4),
    )
  }

  if (
    /\b(api key|open.?router key|sk-or-|secret key|bearer)\b/i.test(low) ||
    /\bwhere (do i|can i|to) (get|find|buy|generate).*\bkey\b/i.test(low)
  ) {
    return pick(
      [
        `Keys come from your provider. For OpenRouter, create one at ${OPENROUTER_URL_KEYS} (home ${OPENROUTER_URL_HOME}) - look for “create key” (sk-or-v1-…). Paste it into the API key field at the top; it is kept in session storage in your browser (not sent to TeamTestHub servers - this front end is static).`,
        'Grab an OpenRouter API key from the OpenRouter dashboard. This UI stores it locally for your session so requests go from your browser through OpenRouter’s API.',
        'You will need a credited OpenRouter account per their docs; then copy sk-or-v1-… here and use Save & Verify.',
        `New to the dashboard? Open ${OPENROUTER_URL_HOME}, sign in, then ${OPENROUTER_URL_KEYS} → create a secret - the field here accepts sk-or-v1- tokens.`,
        'Treat keys like passwords: rotate if leaked, never paste them into random sites - here they stay in your browser session until refresh or privacy mode clears storage.',
      ],
      s(5),
    )
  }

  if (/\b(no key|without a key|demo (limit|mode)|message limit|turn limit)\b/i.test(low)) {
    return pick(
      [
        'Without a key you still get the local chat bot here with no turn cap; replies stay scripted until you connect OpenRouter.',
        'The guest bot runs in your browser only and does not limit how many messages you send; add a key when you want live models.',
        'Demo mode is deliberate: you can click every affordance, resize panels, and rehearse exports without spending tokens.',
        'Nothing in this tab phones home for inference until you save a key - the scripted assistant is only animating the chrome.',
      ],
      s(6),
    )
  }

  if (
    /\bhow (do i|to) (pick|select|choose|add).*\bmodel/i.test(low) ||
    /\bmodel (picker|grid|list|chip|selector)\b/i.test(low) ||
    /\bwhich model\b/i.test(low)
  ) {
    return pick(
      [
        'Scroll the model sections (text, image, etc.) and tap a chip to toggle it on. With a key saved you can multi-select; filters help narrow the catalog. Explore can auto-add a few cheap models to get started.',
        'Models are chosen from the catalog grid under the composer - click to include or exclude. Selected IDs appear as chips; your prompt fans out to each selected model when live.',
      ],
      s(7),
    )
  }

  if (/\b(openrouter|open router)\b/i.test(low) && /\bwhat (is|’s)|explain|why\b/i.test(low)) {
    return pick(
      [
        'OpenRouter is an API gateway to many LLMs with one key and unified billing. TeamTestHub talks to it using OpenAI-compatible /v1/chat/completions and /v1/models.',
        'OpenRouter fronts vendors’ models behind one OpenAI-style API - that is why one key unlocks many providers here.',
        `Their catalog and pricing live on ${OPENROUTER_URL_HOME}; keys are issued from ${OPENROUTER_URL_KEYS}.`,
        'Think “Stripe for model endpoints”: routing, auth, and metering sit behind one compatible surface area.',
      ],
      s(8),
    )
  }

  if (/\b(export|download).*\b(json|markdown|md|csv|run)\b/i.test(low) || /\bexport (results|run)\b/i.test(low)) {
    return pick(
      [
        'In Red Team runs you can export batches to JSON, Markdown, or CSV from the results panel after a run. On the chat side you can export conversation snippets where the UI exposes it - handy for reports.',
        'Exports are meant for research and audit trails - grab structured files once you have real outputs from live models.',
      ],
      s(9),
    )
  }

  if (/\b(privacy|cookie|tracking|telemetry|my data|safe)\b/i.test(low)) {
    return pick(
      [
        'By design the default app ships as static files: keys live in sessionStorage, prompt library in localStorage, optional high-privacy mode can drop keys on refresh. Read the site copy for the latest wording.',
        'Your key stays in the browser session you control - there is no required TeamTestHub backend for the core UI.',
      ],
      s(10),
    )
  }

  if (/\b(pricing|cost|credit|billing|how much)\b/i.test(low)) {
    return pick(
      [
        'OpenRouter bills per model and token on their dashboard - TeamTestHub does not add a separate fee in this open client; you pay providers through OpenRouter.',
        'Check openrouter.ai for current rates and credits; this client only sends the prompts you write.',
      ],
      s(11),
    )
  }

  if (/\b(provider|openai direct|groq|together|anthropic direct)\b/i.test(low) && /\bhow|switch|use\b/i.test(low)) {
    return pick(
      [
        'The LLM provider control sits with the API key: OpenRouter is the default path for many models. Other entries use whatever paths your deployment wires - pick one and paste the key style that provider expects.',
        'Switch provider next to the key field; each backend has its own key rules - OpenRouter is the “many models, one key” route.',
      ],
      s(12),
    )
  }

  if (/\b(refusal|policy|safety|jailbreak|guardrail)\b/i.test(low) && /\b(test|check|red)\b/i.test(low)) {
    return pick(
      [
        'Red Team mode is for comparing how different models refuse or comply on the same prompt - pair that with the refusal heuristics in the UI when live.',
        'Run the same prompt across vendors to see who tightens policy first - that is the core loop Red Team is built around.',
      ],
      s(13),
    )
  }

  if (/\b(first page|landing|preview|section 1)\b/i.test(low) || /\bhow (do i|to) (start|begin)\b/i.test(low)) {
    return pick(
      [
        'Start by pasting a key (or stay in demo). In Chat, pick models and use the composer; in Red Team, set up the batch prompt and model list from the run panel.',
        'Flow: key → pick mode (Chat or Red Team) → choose models → send. The numbered sections on the Red Team page walk through provider, prompt, and run.',
      ],
      s(14),
    )
  }

  if (/\b(where|which).*\b(key field|api field|input|box|top of)\b/i.test(low) || /\b(masthead|header).*\bkey\b/i.test(low)) {
    return pick(
      [
        'The API key field lives in the top strip with the provider selector - paste sk-or-v1-… for OpenRouter, then Save & Verify.',
        'Scroll to the page header: key + provider sit together above the main workspace; that is the only place you enter credentials in this UI.',
      ],
      s(15),
    )
  }

  if (/\b(verify|save).*\bkey\b/i.test(low) || /\b(key (not )?work|invalid key|401|403)\b/i.test(low)) {
    return pick(
      [
        'Use Save & Verify after pasting - the client calls OpenRouter’s /models (or your provider) to confirm the key. If it fails, re-copy from the provider dashboard and check for extra spaces.',
        'A bad key usually means typo, revoked token, or wrong provider row - double-check you picked OpenRouter if that is the key type you hold.',
      ],
      s(16),
    )
  }

  if (/\b(stream|streaming|token)\b/i.test(low) && /\b(model|chat|response)\b/i.test(low)) {
    return pick(
      [
        'With a valid key, assistant replies stream like standard chat UIs - token deltas arrive until completion (unless the model or provider batches differently).',
        'You should see incremental text as the model generates - that only happens when you leave demo mode and hit live endpoints.',
      ],
      s(17),
    )
  }

  if (/\b(compare|which (is )?better|side by side|two models)\b/i.test(low)) {
    return pick(
      [
        'Select multiple model chips, send once, and read them in separate columns or blocks - that is the parallel compare pattern. Red Team makes that the main event; Chat can still multi-select.',
        'Add two or more model IDs, fire the same prompt, then diff tone, length, and refusal behavior by eye or export.',
      ],
      s(18),
    )
  }

  if (/\b(workflow|step|sequence|order)\b/i.test(low) && /\b(chat|red|run)\b/i.test(low)) {
    return pick(
      [
        'Typical chat workflow: choose Chat mode, pick models, type in the composer, read responses, export if needed. Red Team: pick models, set system + user blocks if your layout uses them, launch run, review grid, export JSON/MD/CSV.',
        'Order is mode first (Chat vs Red Team), then models, then prompt - the UI follows that left-to-top flow so you do not send blind.',
      ],
      s(19),
    )
  }

  if (/\b(error|failed|not working|broken|bug)\b/i.test(low) && /\b(site|app|chat|key)\b/i.test(low)) {
    return pick(
      [
        'Check the browser console and network tab for 401/429 from OpenRouter - usually key, quota, or model id. Demo mode never hits the network, so if you see odd behavior there, it is local state; add a key to test real calls.',
        'Refresh may clear sessionStorage keys in some privacy modes - re-verify the key. Also confirm CORS: this static app calls OpenRouter from the browser per their rules.',
      ],
      s(20),
    )
  }

  return null
}

