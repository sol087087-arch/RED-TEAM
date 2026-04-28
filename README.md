<p align="center">
  <img src="https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/master/icons/shield.svg" width="80" />
</p>

<h1 align="center">T E A M &nbsp; T E S T H U B</h1>

<p align="center">
  <a href="https://teamtesthub.us"><strong>🚀 teamtesthub.us</strong></a>
</p>

<p align="center">
  <strong>Drop one prompt. Watch every model squirm (or comply).</strong><br />
  Built for red teamers, prompt engineers, and researchers who are tired of the "twelve-tab dance." 
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Security-Red_Teaming-red?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Focus-Privacy-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Powered_by-OpenRouter-black?style=for-the-badge" />
</p>

---

### ⚡ The Workflow
Standard testing is slow. **TeamTestHub** is a shotgun blast to the face of LLM safety layers.

- **Parallel Blast:** Send one prompt to an entire fleet of models simultaneously.
- **Refusal Radar:** Heuristic detection for "Creative Refusal Theater" (e.g., `notprovide`, `policy`, `safety`).
- **Live Stream:** Real-time replies with latency tracking and pass/block status.
- **Compare & Contrast:** Side-by-side analysis to see which model's guardrails flipped first.

---

### 🛠️ Feature Set

| Feature | Description |
| :--- | :--- |
| **🎯 Direct Targeting** | Resend to a single model without re-running the entire batch. |
| **🔄 Thread Continuity** | Continue the conversation with successful replies. |
| **📚 Local Library** | Save templates and labels directly in your browser (`localStorage`). |
| **📦 Data Export** | Clean exports to **JSON, Markdown, or CSV**. |
| **📱 Mobile Ready** | Optimized export defaults for mobile research. |

---

### 🔒 Privacy First
We don't want your data, and we definitely don't want your keys.
- **Zero Backend:** The app is a collection of static files.
- **Client-Side Keys:** Your OpenRouter API key stays in `sessionStorage`. 
- **No Cookies:** No tracking, no drama, no telemetry.

---

### 🚀 Getting Started

**Run it locally**
```bash
# Clone and enter the frontend
cd frontend

# Install dependencies
npm install

# Launch the lab
npm run dev

Navigate to http://localhost:5173, paste your sk-or-v1-… key, and start testing.

Production Build
Bash

npm run build

Deploy the contents of frontend/dist/ to any static host (IONOS, Vercel, Netlify).
📂 Repository Structure
Plaintext

prompt-testing-platform/
├── frontend/
│   ├── src/           # React + TypeScript core
│   ├── public/        # SEO & static assets
│   └── dist/          # Production output
├── backend/           # Optional FastAPI stack
└── logo*.png          # Branding assets

🌐 Deployment Configuration

The app interfaces with OpenRouter via a configurable API base.

    Dev: Uses Vite’s same-origin proxy to bypass CORS.

    Prod: Ensure /openrouter-api proxies to https://openrouter.ai/api/v1 or set VITE_OPENROUTER_API_BASE in your environment.
