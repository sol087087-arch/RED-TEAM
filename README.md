# TeamTestHub

A browser-based tool for testing language models. Send a prompt to many models at once, see who complies and who refuses.

**Live:** [teamtesthub.us](https://teamtesthub.us)

<p align="center">
  <img src="illustration/image2_.jpg" width="1040" />
</p>

---

## Why I built this

Testing the same prompt across a dozen model UIs by hand is slow, frustrating, and doesn't scale. Models served via API also tend to have fewer content restrictions than their consumer interfaces - which makes them more useful for dataset generation, prompt research, and anything where you need honest output rather than a sanitized one.

I needed something that let me run large batches of prompts across many models at once, see the results side by side, and not spend ten minutes clicking through different websites to do it. OpenRouter solves the API aggregation problem but not the interface problem - so I built my own.

How I actually use it:

- I moderate [r/GPT_jailbreaks](https://reddit.com/r/GPT_jailbreaks) and use this to quickly verify whether a submitted jailbreak actually works across current models, or whether it's just a prompt that looks interesting but does nothing
- I work on dataset generation and model fine-tuning - running the same task across hundreds of models and ranking outputs by quality, speed, and consistency is much easier when everything is in one place and exports to JSON, CSV, or Markdown
- General prompt testing: figuring out which model handles a specific task best before committing to it for a larger workload

The refusal detection heuristics are tuned for jailbreak-style prompts, but the tool itself is general purpose. If you have ideas for how to make it more useful, open an issue.

---

## What it does

**Red Team mode** - run one prompt against multiple models in parallel. Each response is automatically classified: complied, refused, or unclear. Useful for comparing model behavior, testing jailbreaks, or checking how different providers handle the same input.

<p align="center">
  <img src="illustration/image3(1).jpg" width="1040" />
</p>

**Chat mode** - group chat with multiple models simultaneously. Useful when you want to compare how different models respond to the same conversation, or just talk to models without an extra layer of content filtering between you and the API.

Each model receives only the shared conversation history - it never sees what other models replied. This prevents response contamination: model B's answer cannot influence model A's output, so you get independent responses to the same input rather than models reacting to each other.

Bring your own API key (OpenRouter, or direct provider). Nothing is stored - keys and chat history stay in your browser only.

## Why there's no backend

Storing other people's API keys is a responsibility I have no interest in taking on. There's no server, no database, no logs. Your keys, your prompts, and your conversations with models never leave your browser - I have no way to see them and no desire to. Use the tool however you want; what you do with it is entirely your business.

---

## Who it's for

- Red team researchers comparing model safety across providers
- People who work with LLMs daily and want a faster way to test prompts
- Anyone curious about how different models handle the same question
- Prompt engineers testing new jailbreaks or system prompt designs

This is not a product or a SaaS. It's a tool I built for myself and made usable for others.

---

## Stack

React 18 + TypeScript + Vite. No backend. All API calls go directly from your browser to the provider.

---

## Repository structure

```
RED-TEAM/
└── prompt-testing-platform/
    ├── frontend/
    │   ├── src/       # React + TypeScript core
    │   ├── public/    # SEO & static assets
    │   └── dist/      # Production output
    ├── backend/       # Optional FastAPI stack (not used in production)
    └── logo*.png      # Branding assets
```

---

## Run locally

```bash
cd prompt-testing-platform/frontend
npm install
npm run dev
```

> On Windows you can also run `setup.bat` from the `prompt-testing-platform/` folder.

Open `http://localhost:5173`. Enter your OpenRouter API key (or any OpenAI-compatible endpoint) and start testing.

### Production build

```bash
npm run build
```

Required environment variable for production:

```
VITE_OPENROUTER_API_BASE=https://openrouter.ai/api/v1
```

---

## Models

Supports OpenRouter (400+ models) and custom OpenAI-compatible endpoints. Without an API key, the full model list is visible - you can browse and enter a key to unlock.

---

## Refusal detection

Responses are automatically classified using heuristic pattern matching - first-person refusals, dialect variants, BPE tokenizer artifacts, content filter signals. Classification is intentionally transparent: every result shows the reason.

`complied` means the model answered. `fail` means it refused. `unknown` means the signal was ambiguous.

---

## Roadmap

- **Mutation engine** - automatically vary a prompt (paraphrase, role injection, language switch, encoding tricks) and run all variants across all selected models. UI placeholder is already there; implementation is next.
- More providers beyond OpenRouter
- Local model support (Ollama, LM Studio, and other OpenAI-compatible local endpoints)
- Possibly a fuller hub over time, but no promises
