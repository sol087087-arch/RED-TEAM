export function FirstPagePreview() {
  return (
    <section className="landing-preview" aria-hidden>
      <article className="landing-preview__card">
        <div className="section-header">
          <span className="section-num">2</span>
          <h2>Select Models</h2>
        </div>
        <p className="hint">Filter catalog, pick targets, and run tests in parallel.</p>
        <div className="landing-preview__chips">
          <span className="landing-preview__chip">Filter models</span>
          <span className="landing-preview__chip">Select all filtered</span>
          <span className="landing-preview__chip">Clear selection</span>
        </div>
      </article>

      <article className="landing-preview__card">
        <div className="section-header">
          <span className="section-num">3</span>
          <h2>Prompt + Run Controls</h2>
        </div>
        <p className="hint">Compose prompt, set run name, use the prompt library, tune temperature, start run.</p>
        <div className="landing-preview__chips">
          <span className="landing-preview__chip">Run name</span>
          <span className="landing-preview__chip">Prompt library</span>
          <span className="landing-preview__chip">Run selected</span>
        </div>
      </article>

      <article className="landing-preview__card">
        <div className="section-header">
          <span className="section-num">4</span>
          <h2>Results + Export</h2>
        </div>
        <p className="hint">See live responses, continue chat, compare runs, and export reports.</p>
        <div className="landing-preview__chips">
          <span className="landing-preview__chip">Live results</span>
          <span className="landing-preview__chip">Continue chat</span>
          <span className="landing-preview__chip">CSV / JSON / MD</span>
        </div>
      </article>
    </section>
  )
}
