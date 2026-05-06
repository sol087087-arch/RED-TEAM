/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CF_ANALYTICS_BEACON_URL?: string
  /** Override OpenRouter API base (default: `/openrouter-api` - must be same-origin proxied). */
  readonly VITE_OPENROUTER_API_BASE?: string
  /** Max completion tokens per call (default 16384). */
  readonly VITE_OPENROUTER_MAX_OUTPUT_TOKENS?: string
  /**
   * Chat sidebar: Send feedback.
   * Use `mailto:you@example.com?subject=...&body=...` to open the user’s mail client;
   * `http(s)://` opens in a new tab.
   */
  readonly VITE_FEEDBACK_URL?: string
  /**
   * Chat sidebar: “Download source (ZIP)” — direct URL to a `.zip` (e.g. GitHub
   * `https://github.com/org/repo/archive/refs/heads/main.zip`). Browser downloads; no server-side 7z.
   */
  readonly VITE_DOWNLOAD_APP_URL?: string
}
