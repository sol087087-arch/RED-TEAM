import clearKeyIcon from '../assets/icons/actions/clear5.png'
import type { ApiKeySectionProps } from './types'

export function ApiKeySection(props: ApiKeySectionProps) {
  const {
    theme,
    onToggleTheme,
    keySaved,
    clearKey,
    highPrivacyMode,
    setHighPrivacyMode,
    keyInput,
    setKeyInput,
    handleSaveKey,
    modelsLoading,
  } = props

  return (
    <section className={`section ${keySaved ? 'section--compact' : ''}`}>
      <div className="section-header">
        <span className="section-num">1</span>
        <h2>OpenRouter API Key</h2>
        {keySaved && <span className="badge-ok section-header__status">✓ API key verified</span>}
        <div className="section-header__tools">
          {keySaved ? (
            <button
              type="button"
              className="btn btn--match-action btn--icon-action"
              onClick={clearKey}
              aria-label="Clear key"
              title="Clear key"
            >
              <span
                className="response-action-icon response-action-icon--clear-key response-action-icon--btn-tone"
                style={{
                  WebkitMaskImage: `url(${clearKeyIcon})`,
                  maskImage: `url(${clearKeyIcon})`,
                }}
                aria-hidden="true"
              />
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--match-action btn--icon-action theme-switch"
            data-active={theme}
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <span className="theme-switch__thumb" aria-hidden />
            <div className="theme-switch__stack">
              <span className="theme-switch__half theme-switch__half--light" aria-hidden>
                ☀
              </span>
              <span className="theme-switch__half theme-switch__half--dark" aria-hidden>
                ☾
              </span>
            </div>
          </button>
        </div>
      </div>
      {!keySaved ? (
        <>
          <div className="api-key-section__intro">
            <p className="hint">
              Get your key at{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
                openrouter.ai/keys
              </a>
              . Your key is never sent to our server. It stays in this browser session only and is removed when the
              session ends.
            </p>
            <p className="hint">No cookies. No personal tracking. Optional analytics are aggregate-only.</p>
            <label className="privacy-toggle">
              <input
                type="checkbox"
                checked={highPrivacyMode}
                onChange={(e) => setHighPrivacyMode(e.target.checked)}
              />
              <span>High privacy mode: forget key on page refresh.</span>
            </label>
            <p className="hint">
              Run the app with <code>npm run dev</code> so API calls work (same-origin proxy).
            </p>
          </div>
          <form
            className="api-key-section__form"
            autoComplete="off"
            onSubmit={e => {
              e.preventDefault()
              handleSaveKey()
            }}
          >
            <div className="input-row">
              <input
                id="openrouter-api-key"
                name="openrouter-api-key"
                type="text"
                className="api-key-section__input"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="sk-or-v1-..."
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                inputMode="text"
              />
              <button type="submit" className="btn btn--primary" disabled={modelsLoading}>
                {modelsLoading ? 'Verifying...' : 'Save & Verify'}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </section>
  )
}
