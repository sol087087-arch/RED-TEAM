<p align="center">
  <img src="logo.png" alt="TeamTestHub Logo" width="80" />
</p>

<h1 align="center">T E A M &nbsp; T E S T &nbsp; H U B</h1>

<p align="center">
  <a href="https://teamtesthub.us"><strong>teamtesthub.us</strong></a>
</p>

<p align="center">
  <strong>One interface. Many models. Test guardrails or just chat.</strong><br />
  TeamTestHub is a browser-based workspace for <strong>parallel prompt evaluation</strong> and <strong>multi-model chat</strong>, powered by OpenRouter—no server required for the main app.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Workspace-Red_Team_plus_Chat-6c3483?style=for-the-badge" alt="Workspace: Red Team plus Chat" />
  <img src="https://img.shields.io/badge/Focus-Privacy-blue?style=for-the-badge" alt="Focus: Privacy" />
  <img src="https://img.shields.io/badge/Powered_by-OpenRouter-black?style=for-the-badge" alt="Powered by OpenRouter" />
</p>

---

### Two workspaces

After you add your API key, switch between modes from the header:

| Mode | What it is for |
| :--- | :--- |
| **Red Team** | Send one prompt to a fleet of models at once. Compare refusals, latency, and tone side by side. Heuristics flag common refusal patterns (policy blocks, “cannot provide”, safety boilerplate). |
| **Chat** | Talk with one or more models in a familiar chat layout—threads, continuations, and the same model roster without opening a dozen vendor tabs. |

Same privacy model in both modes: keys and conversation state stay on your machine unless you choose to export.

---

### Highlights

- **Parallel runs (Red Team):** One blast across many models; resend to a single model without redoing the whole batch.
- **Refusal radar:** Fast signals when answers look like policy refusals or deflections—not a substitute for human review, but a useful sort key during sweeps.
- **Live feedback:** Streaming replies, timing, and pass/block-style status for quick triage.
- **Thread continuity:** Continue from replies that went the way you wanted.
- **Local library:** Prompt templates and labels in `localStorage`.
- **Exports:** JSON, Markdown, and CSV for runs and reports; layout stays usable on mobile when you are exporting in the field.

---

### Privacy first

We do not want your data, and we do not want your keys.

- **No mandatory backend:** The shipping app is static files (React + Vite). Run it locally or host `frontend/dist/` on any static file host.
- **Client-side keys:** Your OpenRouter API key lives in `sessionStorage` in the browser session you configure.
- **No cookies:** No ad trackers or product telemetry in this flow.

An optional **FastAPI** stack lives under `backend/` if you extend the project with server-side features; the default product path does not depend on it.

---

### Getting started

#### Run locally

From the directory that contains this README (`prompt-testing-platform`):

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**, paste your OpenRouter key (`sk-or-v1-…`), pick **Red Team** or **Chat**, and go.

If your Git clone puts this repo under another folder (for example `RED-TEAM/prompt-testing-platform`), `cd` into `prompt-testing-platform` first, then `cd frontend` as above.

#### Production build

```bash
cd frontend
npm run build
```

Deploy the contents of **`frontend/dist/`** to any static host (Vercel, Netlify, AWS S3, IONOS, etc.).

Optional production base URL for the OpenRouter API (default is the public OpenRouter endpoint):

```bash
VITE_OPENROUTER_API_BASE=https://openrouter.ai/api/v1
```

---

### Repository layout

```text
prompt-testing-platform/
├── frontend/
│   ├── src/           # React + TypeScript app
│   ├── public/        # Static assets & SEO
│   └── dist/          # `npm run build` output
├── backend/           # Optional FastAPI services
└── logo*.png          # Branding (paths relative to this folder)
```

---
