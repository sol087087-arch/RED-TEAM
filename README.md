# T E A M &nbsp; T E S T &nbsp; H U B

[**teamtesthub.us**](https://teamtesthub.us)

**One prompt. Every model. Instant comparison.**  
A streamlined platform for red teamers and prompt engineers to benchmark multiple LLMs simultaneously via OpenRouter.

---

## Capabilities

| Feature | Details |
| :--- | :--- |
| **Parallel Execution** | Send prompts to multiple models at once in isolated sessions. |
| **Real-time Metrics** | Streaming responses with latency tracking and Pass/Block/Error status. |
| **Refusal Detection** | Heuristic-based monitoring for safety refusals and "creative theater." |
| **Session Management** | Individual model retries and thread continuation (where supported). |
| **Comparison Tools** | Side-by-side run analysis and local prompt library (localStorage). |
| **Data Export** | Support for JSON, Markdown, and CSV formats. |

---

## Privacy & Security

The application is served as static files. No user data is stored on our infrastructure.

*   **API Keys:** Your OpenRouter key stays in `sessionStorage` and never touches our servers.
*   **Persistence:** Prompt templates and themes are stored locally in your browser's `localStorage`.
*   **Zero Backend:** No accounts or databases required for the core tool.

---

## Installation

### Local Development
```bash
cd frontend
npm install
npm run dev
Navigate to http://localhost:5173 and enter your OpenRouter API key.
Production Build
Bash

cd frontend
npm run build

Upload the contents of frontend/dist/ to your static hosting provider.
Project Structure

    frontend/: React + TypeScript application source.

    frontend/public/: SEO assets (robots.txt, sitemap.xml).

    backend/: Optional FastAPI stack (not required for static UI).

    logo.png: Branding assets.

Deployment Note

Ensure your production environment proxies /openrouter-api to https://openrouter.ai/api/v1 or configure VITE_OPENROUTER_API_BASE accordingly to avoid CORS issues.
