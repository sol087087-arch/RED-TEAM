<p align="center">
</p>

<h1 align="center">T E A M &nbsp; T E S T &nbsp; H U B</h1>

<p align="center">
  <a href="https://teamtesthub.us"><strong>teamtesthub.us</strong></a>
</p>

<p align="center">
  <strong>Drop one prompt. Watch every model squirm (or comply).</strong><br />
  Built for red teamers, prompt engineers, and researchers who are tired of the "twelve-tab dance."
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Security-Red_Teaming-red?style=for-the-badge" alt="Security: Red Teaming" />
  <img src="https://img.shields.io/badge/Focus-Privacy-blue?style=for-the-badge" alt="Focus: Privacy" />
  <img src="https://img.shields.io/badge/Powered_by-OpenRouter-black?style=for-the-badge" alt="Powered by OpenRouter" />
</p>

---

### The Workflow

Standard testing is slow. **TeamTestHub** is a shotgun blast to the face of LLM safety layers.

- **Parallel Blast:** Send one prompt to an entire fleet of models simultaneously.
- **Refusal Radar:** Heuristic detection for "Creative Refusal Theater" (e.g., `cannot provide`, `against policy`, `safety guidelines`).
- **Live Stream:** Real-time replies with latency tracking and pass/block status.
- **Compare & Contrast:** Side-by-side analysis to see which model's guardrails flipped first.

---

### Feature Set

| Feature | Description |
| :--- | :--- |
| **🎯 Direct Targeting** | Resend to a single model without re-running the entire batch. |
| **🔄 Thread Continuity** | Continue the conversation with successful replies. |
| **📚 Local Library** | Save templates and labels directly in your browser (`localStorage`). |
| **📦 Data Export** | Clean exports to **JSON, Markdown, or CSV**. |
| **📱 Mobile Ready** | Optimized export defaults for mobile research. |

---

### Privacy First

We don't want your data, and we definitely don't want your keys.

- **Zero Backend:** The app is a collection of static files.
- **Client-Side Keys:** Your OpenRouter API key stays in `sessionStorage`.
- **No Cookies:** No tracking, no drama, no telemetry.

---

### Getting Started

#### Run it locally

```bash
git clone https://github.com/sol087087-arch/RED-TEAM.git
cd RED-TEAM/frontend

npm install
npm run dev
```

Navigate to **http://localhost:5173**, paste your `sk-or-v1-…` key, and start testing.

#### Production build

From the repository root (the folder that contains `frontend/`):

```bash
cd frontend
npm run build
```

Deploy the contents of **`frontend/dist/`** to any static host (IONOS, Vercel, Netlify, AWS S3, etc.).

---

### Repository structure

```text
RED-TEAM/
├── frontend/
│   ├── src/           # React + TypeScript core
│   ├── public/        # SEO & static assets
│   └── dist/          # Production output
├── backend/           # Optional FastAPI stack (if needed)
└── logo*.png          # Branding assets
```

Environment variable for production:

```bash
VITE_OPENROUTER_API_BASE=https://openrouter.ai/api/v1
```

---

### License
MIT © TeamTestHub

