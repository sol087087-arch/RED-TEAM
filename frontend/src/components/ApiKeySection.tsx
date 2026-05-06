import { useEffect, useState } from 'react'
import clearKeyIcon from '../assets/icons/actions/clear5.png'
import { chatOrbSheenStyle } from '../features/chat/modelChipSheen'
import { LLM_PROVIDERS, getProviderInfo, detectProviderFromKey } from '../services/llmProviders'
import type { ApiKeySectionProps } from './types'

export function ApiKeySection(props: ApiKeySectionProps) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false,
  )
  const [keyVisible, setKeyVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const {
    theme,
    onToggleTheme,
    keySaved,
    clearKey,
    highPrivacyMode,
    setHighPrivacyMode,
    llmProviderId,
    setLlmProviderId,
    llmCustomBase,
    setLlmCustomBase,
    keyInput,
    setKeyInput,
    handleSaveKey,
    modelsLoading,
  } = props

  const providerMeta = getProviderInfo(llmProviderId) ?? LLM_PROVIDERS[0]
  const keyPlaceholder = providerMeta.keyPlaceholder

  // Auto-detect provider from key prefix
  useEffect(() => {
    const detected = detectProviderFromKey(keyInput)
    if (detected && detected !== llmProviderId) setLlmProviderId(detected)
  }, [keyInput])


  return (
    <section className={`section ${keySaved ? 'section--compact' : ''}`}>
      <div className="section-header">
        <h2>{isMobile ? 'LLM API' : 'LLM provider & API key'}</h2>
        {keySaved && !isMobile && <span className="badge-ok section-header__status">✓ API key verified</span>}
        <div className="section-header__tools">
          {keySaved ? (
            <button
              type="button"
              className="btn btn--match-action btn--icon-action chrome-pill-surface workspace-ui-hover workspace-ui-sheen"
              style={chatOrbSheenStyle('apiKey:clear')}
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
            className="btn btn--match-action btn--icon-action theme-switch theme-switch--diagonal chrome-pill-surface workspace-ui-hover workspace-ui-sheen"
            style={chatOrbSheenStyle('apiKey:theme')}
            data-active={theme}
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <span className="theme-switch__thumb" aria-hidden />
            <div className="theme-switch__stack theme-switch__stack--diagonal">
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
              {providerMeta.keysUrl ? (
                <>
                  <a href={providerMeta.keysUrl} target="_blank" rel="noreferrer">
                    Get {providerMeta.label} API keys
                  </a>
                  .{' '}
                </>
              ) : null}
              Your key stays in this browser session only (unless high-privacy mode is on).
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
          </div>
          <form
            className="api-key-section__form"
            autoComplete="off"
            onSubmit={e => {
              e.preventDefault()
              handleSaveKey()
            }}
          >
            <div className="input-row api-key-section__main-row">
              <div className="api-key-section__key-column">
                <div className="api-key-section__key-shell workspace-ui-hover-soft chrome-pill-surface">
                  <div className="api-key-section__key-shell-input">
                    <div className="api-key-section__field-wrap api-key-section__field-wrap--key">
                      {keyInput.trim() !== '' && (
                        <button
                          type="button"
                          className="api-key-section__eye-btn"
                          onClick={() => setKeyVisible(v => !v)}
                          aria-label={keyVisible ? 'Hide API key' : 'Show API key'}
                          tabIndex={-1}
                        >
                          {keyVisible ? '🙈' : '👁'}
                        </button>
                      )}
                      <input
                        id="llm-api-key"
                        name="llm-api-key"
                        type={keyVisible ? 'text' : 'password'}
                        className="api-key-section__input api-key-section__input--key-masked"
                        value={keyInput}
                        onChange={e => setKeyInput(e.target.value)}
                        placeholder={keyPlaceholder}
                        spellCheck={false}
                        autoComplete="off"
                        autoCorrect="off"
                        aria-label="API key"
                        inputMode="text"
                      />
                    </div>
                  </div>
                </div>
                {keyInput.trim() !== '' && llmProviderId === 'custom' ? (
                  <div className="workspace-ui-hover-soft chrome-pill-surface api-key-section__field-wrap api-key-section__field-wrap--custom">
                    <input
                      id="llm-custom-base"
                      name="llm-custom-base"
                      type="text"
                      className="api-key-section__input api-key-section__input--custom-base"
                      value={llmCustomBase}
                      onChange={e => setLlmCustomBase(e.target.value)}
                      placeholder="/my-openai-proxy/v1"
                      spellCheck={false}
                      autoComplete="off"
                      aria-label="API base path (same-origin)"
                      inputMode="text"
                    />
                  </div>
                ) : null}
              </div>
              <button
                type="submit"
                className="btn btn--primary btn--match-action chrome-pill-surface workspace-ui-hover workspace-ui-sheen api-key-section__save-btn"
                style={chatOrbSheenStyle('apiKey:save')}
                disabled={modelsLoading}
              >
                {modelsLoading ? 'Verifying...' : 'Save & Verify'}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </section>
  )
}
