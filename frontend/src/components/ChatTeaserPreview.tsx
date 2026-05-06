/**
 * Non-interactive Poe-style layout preview (inspired by common chat UIs; not affiliated with Poe).
 */
export function ChatTeaserPreview(props: { variant?: 'landing' | 'active' }) {
  const active = props.variant === 'active'
  return (
    <div className={`chat-teaser ${active ? 'chat-teaser--active' : ''}`} aria-hidden>
      {active ? (
        <p className="hint chat-teaser__lead">
          API key connected - full chat composer ships next. This is a static preview.
        </p>
      ) : null}
      <div className="chat-teaser__chrome">
        <aside className="chat-teaser__rail">
          <span className="chat-teaser__rail-dot" title="" />
          <span className="chat-teaser__rail-dot" title="" />
          <span className="chat-teaser__rail-dot" title="" />
          <span className="chat-teaser__rail-fab" aria-hidden>
            +
          </span>
        </aside>
        <div className="chat-teaser__stack">
          <header className="chat-teaser__topbar">
            <span className="chat-teaser__topbar-title">Assistant</span>
            <span className="chat-teaser__topbar-chevron" aria-hidden />
          </header>
          <div className="chat-teaser__thread">
            <div className="chat-teaser__msg chat-teaser__msg--user">
              Summarize zero-trust in two bullets.
            </div>
            <div className="chat-teaser__msg chat-teaser__msg--assistant">
              • Never trust, always verify identities and devices.
              <br />• Assume breach: segment networks and monitor continuously.
            </div>
          </div>
          <footer className="chat-teaser__composer">
            <div className="chat-teaser__composer-inner">
              <span className="chat-teaser__composer-placeholder">Message the assistant…</span>
              <span className="chat-teaser__composer-send" aria-hidden>
                ↑
              </span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
