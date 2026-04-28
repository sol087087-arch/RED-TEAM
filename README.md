<pre align="center">
████████╗███████╗ █████╗ ███╗   ███╗████████╗███████╗███████╗████████╗
╚══██╔══╝██╔════╝██╔══██╗████╗ ████║╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝
   ██║   █████╗  ███████║██╔████╔██║   ██║   █████╗  ███████╗   ██║
   ██║   ██╔══╝  ██╔══██║██║╚██╔╝██║   ██║   ██╔══╝  ╚════██║   ██║
   ██║   ███████╗██║  ██║██║ ╚═╝ ██║   ██║   ███████╗███████║   ██║
   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚══════╝╚══════╝   ╚═╝
</pre>

<p align="left">
  <strong>T E A M &nbsp; T E S T &nbsp; H U B</strong><br />
  <sub>test · build · iterate</sub><br /><br />
  <a href="https://teamtesthub.us"><strong>teamtesthub.us</strong></a>
  &nbsp;·&nbsp;
</p>

<p align="left">
  <strong>Drop one prompt. Watch every model squirm (or comply).</strong><br />
  Built for red teamers who are tired of copy-pasting the same prompt into twelve browser tabs - and for prompt engineers, researchers, and anyone who wants to know which models will actually do the thing.
</p>

---

## What it does

| | |
|--|--|
| **Parallel blast** | Send your prompt to every model you pick - **simultaneously**, each in isolation. |
| **Live results** | Replies stream in as they arrive, with latency and a **pass / block / error** readout. |
| **Refusal radar** | Heuristic detection across safety-ish refusals (explicit content, weapons, drugs, social engineering, “creative refusal theater”, typos like `notprovide`, …). It’s regex-based - useful signal, not a formal audit. |
| **Retry one model** | Resend without rerunning the whole batch. |
| **Continue chat** | Pick up a thread with a model after the first reply - when it makes sense (no chat on hard errors or empty bodies). |
| **Compare runs** | Put two runs side by side and spot what flipped. |
| **Prompt library** | Save templates and labels in **your browser** (`localStorage`). |
| **Export** | JSON, Markdown, CSV - plus on **mobile**, export defaults to **JSON** in one tap (full dropdown stays on desktop). |

Optional screenshot (add when you have one):

<!-- Uncomment after adding `docs/screenshot.png`:
<p align="center">
  <img src="docs/screenshot.png" alt="TEAMTESTHUB UI" width="720" />
</p>
-->

<p align="center">
</p>

---

## Privacy

Your **OpenRouter API key never hits our servers**. It stays in **`sessionStorage`** for this tab/session (with optional “high privacy” so it isn’t kept across refreshes). Themes, templates, and last run metadata live in **`localStorage`**.  

The deployed app is **static files** (e.g. `frontend/dist` on IONOS). No accounts, no backend required for the live tool.

SEO helpers ship in the build: `robots.txt` and `sitemap.xml` under `frontend/public/` → copied to the site root.

---

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Then open **http://localhost:5173** - paste your **OpenRouter** API key (`sk-or-v1-…`) and go.

Dev uses Vite’s **same-origin proxy** so browser calls don’t trip CORS; keep using `npm run dev`, don’t open raw `file://` HTML.

---

## Production build

```bash
cd frontend
npm run build
```

Upload **everything inside** `frontend/dist/` to your host (e.g. `index.html`, `assets/`, `robots.txt`, `sitemap.xml`, favicon, …).

---

## Repo layout

```text
prompt-testing-platform/
  frontend/
    src/           # React + TypeScript app
    public/        # robots.txt, sitemap.xml, favicon - copied into dist/
    dist/          # production output (npm run build), not always committed
    package.json
  backend/         # optional FastAPI stack (not required for the static OpenRouter UI)
  README.md
  logo*.png        # branding assets (also used in the site header)
```

---

## GitHub vs hosting

| Goal | What to push / upload |
|------|------------------------|
| **GitHub** | Push this repo; ignore committing `frontend/dist` unless you deliberately version builds. |
| **Static host** | Upload fresh **`frontend/dist`** after each `npm run build`. |

---

## Production note

The app talks to OpenRouter via a configurable API base (see `frontend` env / Vite config). In production, ensure **`/openrouter-api`** (or your chosen base) is proxied to **`https://openrouter.ai/api/v1`**, or set **`VITE_OPENROUTER_API_BASE`** to the correct URL your deployment exposes.

---

<p align="center">
  <sub>No cookies. Just prompts vs models.</sub>
</p>
