import { useEffect, useMemo, useRef, useState } from 'react'
import type { RunSnapshot, TestResult } from '../domain/types'
import { buildCompareRunSideByRows } from '../features/compare/compareRunDiff'
import { FilterDropdown } from './FilterDropdown'
import type { ResultsSectionProps } from './types'

function compareRunHeaderLine(prefix: string, r: RunSnapshot) {
  return `${prefix} · ${r.label} · ${new Date(r.timestamp).toLocaleTimeString()} · ${r.modelCount} models`
}

function CompareStatusCell({ status }: { status: TestResult['status'] | null }) {
  if (status === null) {
    return (
      <span className="run-compare__na" title="No result for this model in this run">
        —
      </span>
    )
  }
  let char: string
  let cls: string
  let title: string
  switch (status) {
    case 'pass':
      char = '✓'
      cls = 'status-icon--pass'
      title = 'Complied (pass)'
      break
    case 'fail':
      char = '✗'
      cls = 'status-icon--fail'
      title = 'Blocked (hard)'
      break
    case 'fail_story':
      char = '✗'
      cls = 'status-icon--fail'
      title = 'Blocked (with story)'
      break
    case 'error':
      char = '▲'
      cls = 'status-icon--error'
      title = 'Error'
      break
    default:
      char = '?'
      cls = 'status-icon--unknown'
      title = 'Unknown / empty'
  }
  return (
    <span className={`status-icon ${cls}`} title={title} aria-label={title}>
      {char}
    </span>
  )
}

function CompareRunsMatrixView({ runA, runB }: { runA: RunSnapshot; runB: RunSnapshot }) {
  const rows = buildCompareRunSideByRows(runA, runB)
  if (rows.length === 0) {
    return <p className="hint run-compare__summary">No model rows in these runs.</p>
  }

  return (
    <div className="run-compare__diff">
      <div className="run-compare__table-wrap">
        <table className="run-compare__table run-compare__table--matrix">
          <caption className="run-compare__sr-only">
            Side-by-side reply status for baseline run {runA.label} and compare run {runB.label}.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="run-compare__th run-compare__th--model">
                Model
              </th>
              <th scope="col" className="run-compare__th run-compare__th--run">
                <span className="run-compare__run-line">{compareRunHeaderLine('Baseline', runA)}</span>
              </th>
              <th scope="col" className="run-compare__th run-compare__th--run">
                <span className="run-compare__run-line">{compareRunHeaderLine('Compare to', runB)}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const changed = row.statusBaseline !== row.statusCompare
              return (
                <tr
                  key={row.modelId}
                  className={changed ? 'run-compare__tr--diff' : undefined}
                >
                  <td className="run-compare__td run-compare__td--model">
                    <span className="run-compare__model-name">{row.label}</span>
                  </td>
                  <td className="run-compare__td run-compare__td--status">
                    <CompareStatusCell status={row.statusBaseline} />
                  </td>
                  <td className="run-compare__td run-compare__td--status">
                    <CompareStatusCell status={row.statusCompare} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="hint run-compare__legend">
        ✓ complied · ✗ blocked · ? unclear · ▲ error · — missing in that run. Highlighted rows differ between the
        two runs.
      </p>
    </div>
  )
}

export function ResultsSection(props: ResultsSectionProps) {
  const {
    keySaved,
    runHistory,
    compareRunAId,
    compareRunBId,
    setCompareRunAId,
    setCompareRunBId,
    compareRunA,
    compareRunB,
    loading,
    results,
    selectedModelsSize,
    pendingCount,
    secondsSinceLastResult,
    activeChatModelId,
    activeChatResult,
    closeContinueChat,
    activeChatHistory,
    activeChatModelName,
    chatError,
    chatInput,
    setChatInput,
    sendContinueChat,
    chatLoading,
    passCount,
    blockCount,
    unknownCount,
    errorCount,
    clearResults,
    exportCSV,
    exportJSON,
    exportMarkdown,
    responseStatusBadgeClass,
    replyStatusLine,
    openContinueChat,
    copyText,
    copiedKey,
    retryModelPrompt,
    retryingModels,
    hasPromptToRetry,
  } = props

  const [exportOpen, setExportOpen] = useState(false)
  const [lastExportKind, setLastExportKind] = useState<'csv' | 'json' | 'markdown' | 'all' | null>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (exportMenuRef.current?.contains(e.target as Node)) return
      setExportOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [exportOpen])

  useEffect(() => {
    if (!exportOpen) return
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false)
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [exportOpen])

  const compareRunAItems = useMemo(
    () => [
      {
        value: '',
        labelShort: 'Baseline run',
        labelFull: 'Baseline run — first run in the compare pair',
      },
      ...runHistory.map(r => ({
        value: r.id,
        labelShort: r.label,
        labelFull: `${r.label} · ${new Date(r.timestamp).toLocaleTimeString()} · ${r.modelCount} models`,
      })),
    ],
    [runHistory]
  )

  const compareRunBItems = useMemo(
    () => [
      {
        value: '',
        labelShort: 'Compare to run',
        labelFull: 'Compare to run — second run in the compare pair',
      },
      ...runHistory.map(r => ({
        value: r.id,
        labelShort: r.label,
        labelFull: `${r.label} · ${new Date(r.timestamp).toLocaleTimeString()} · ${r.modelCount} models`,
      })),
    ],
    [runHistory]
  )

  const closeExportMenu = () => setExportOpen(false)

  if (!keySaved) return null

  return (
    <section className="section">
      <div className="section-header">
        <span className="section-num">4</span>
        <h2>Results</h2>
      </div>
      <p className="hint">
        <strong>Reply status</strong> (this app only): summary uses short labels; each card shows the exact type
        next to latency (e.g. <em>block (hard)</em>, <em>block (w/ story)</em>). Re-run after rule changes; saved
        badges update after re-test or clear.
      </p>
      {runHistory.length > 1 && (
        <div className="run-compare">
          <strong className="run-compare__title">Compare runs</strong>
          <div className="input-row run-compare__controls">
            <FilterDropdown
              ariaLabel="Baseline run for compare"
              buttonTitle="First run in the side-by-side diff. Full timestamp and model count appear in the menu."
              value={compareRunAId}
              onChange={setCompareRunAId}
              items={compareRunAItems}
            />
            <FilterDropdown
              ariaLabel="Compare to run"
              buttonTitle="Second run in the side-by-side diff. Full timestamp and model count appear in the menu."
              value={compareRunBId}
              onChange={setCompareRunBId}
              items={compareRunBItems}
            />
          </div>
          {compareRunA && compareRunB && <CompareRunsMatrixView runA={compareRunA} runB={compareRunB} />}
        </div>
      )}
      {loading && (
        <p className="results-progress" aria-live="polite">
          Testing in progress: {results.length}/{selectedModelsSize} model replies received, {pendingCount} pending.{' '}
          {secondsSinceLastResult === null
            ? 'Waiting for first response…'
            : `Last response ${secondsSinceLastResult}s ago.`}{' '}
          Please wait…
        </p>
      )}
      {activeChatModelId && (
        <div className="chat-panel">
          <div className="chat-panel__header">
            <div className="chat-panel__title-wrap">
              <strong className="chat-panel__title">Continue chat</strong>
              <span className="chat-panel__meta">
                {activeChatResult?.modelName || activeChatModelId}
                {activeChatResult?.latencyMs !== null && activeChatResult?.latencyMs !== undefined
                  ? ` · last ${activeChatResult.latencyMs}ms`
                  : ''}
              </span>
            </div>
            <button type="button" className="btn btn--close" onClick={closeContinueChat} aria-label="Close chat">
              ×
            </button>
          </div>

          <div className="chat-panel__messages-shell">
            <div className="chat-panel__messages">
              {activeChatHistory.length === 0 ? (
                <p className="chat-panel__empty">No context yet. Send a message to start.</p>
              ) : (
                activeChatHistory.map(m => (
                  <div key={`${m.role}-${m.ts}`} className={`chat-msg chat-msg--${m.role}`}>
                    <div className="chat-msg__role">{m.role === 'user' ? 'User' : activeChatModelName}</div>
                    <pre className="chat-msg__text">{m.content}</pre>
                  </div>
                ))
              )}
            </div>
          </div>
          {chatError && <p className="chat-panel__error">Error: {chatError}</p>}
          <div className="chat-panel__composer">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Continue this conversation..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void sendContinueChat()
                }
              }}
              disabled={chatLoading}
            />
            <button type="button" className="btn btn--primary" onClick={() => void sendContinueChat()} disabled={chatLoading || !chatInput.trim()}>
              {chatLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
      {results.length === 0 ? (
        <p className="results-placeholder">
          {loading
            ? 'Waiting for model responses…'
            : 'Run a test to see each model’s reply in its own scrollable window below.'}
        </p>
      ) : (
        <>
          <div className="results-summary">
            {passCount > 0 && (
              <span className="badge-pass">
                <span className="status-icon status-icon--pass">✓</span> {passCount} complied
              </span>
            )}
            {blockCount > 0 && (
              <span className="badge-fail">
                <span className="status-icon status-icon--fail">✗</span> {blockCount} block
              </span>
            )}
            {unknownCount > 0 && (
              <span className="badge-unknown">? {unknownCount}</span>
            )}
            {errorCount > 0 && (
              <span className="badge-error">
                <span className="status-icon status-icon--error">⚠</span> {errorCount} {errorCount === 1 ? 'error' : 'errors'}
              </span>
            )}
            <div className="export-buttons">
              <div
                ref={exportMenuRef}
                className={`export-menu${exportOpen ? ' export-menu--open' : ''}`}
              >
                <button
                  type="button"
                  className="btn btn--match-action btn--icon-action export-menu__toggle"
                  aria-label="Download report"
                  title="Download report"
                  aria-expanded={exportOpen}
                  aria-haspopup="menu"
                  onClick={() => setExportOpen(o => !o)}
                >
                  <span className="response-action-icon response-action-icon--download response-action-icon--btn-tone" aria-hidden="true" />
                </button>
                {exportOpen ? (
                  <div className="export-menu__panel" role="presentation">
                    <ul className="export-menu__menu" role="menu">
                      <li role="presentation">
                        <button
                          type="button"
                          role="menuitem"
                          className={`filter-dropdown__option export-menu__item ${
                            lastExportKind === 'csv' ? 'is-selected' : ''
                          }`}
                          title="Download CSV report"
                          aria-label="Download CSV report"
                          onClick={() => {
                            setLastExportKind('csv')
                            exportCSV()
                            closeExportMenu()
                          }}
                        >
                          <span className="export-menu__check" aria-hidden="true">
                            {lastExportKind === 'csv' ? '✓' : ''}
                          </span>
                          <span className="export-menu__label">CSV</span>
                        </button>
                      </li>
                      <li role="presentation">
                        <button
                          type="button"
                          role="menuitem"
                          className={`filter-dropdown__option export-menu__item ${
                            lastExportKind === 'json' ? 'is-selected' : ''
                          }`}
                          title="Download JSON report"
                          aria-label="Download JSON report"
                          onClick={() => {
                            setLastExportKind('json')
                            exportJSON()
                            closeExportMenu()
                          }}
                        >
                          <span className="export-menu__check" aria-hidden="true">
                            {lastExportKind === 'json' ? '✓' : ''}
                          </span>
                          <span className="export-menu__label">JSON</span>
                        </button>
                      </li>
                      <li role="presentation">
                        <button
                          type="button"
                          role="menuitem"
                          className={`filter-dropdown__option export-menu__item ${
                            lastExportKind === 'markdown' ? 'is-selected' : ''
                          }`}
                          title="Download Markdown report"
                          aria-label="Download Markdown report"
                          onClick={() => {
                            setLastExportKind('markdown')
                            exportMarkdown()
                            closeExportMenu()
                          }}
                        >
                          <span className="export-menu__check" aria-hidden="true">
                            {lastExportKind === 'markdown' ? '✓' : ''}
                          </span>
                          <span className="export-menu__label">Markdown</span>
                        </button>
                      </li>
                      <li role="presentation">
                        <button
                          type="button"
                          role="menuitem"
                          className={`filter-dropdown__option export-menu__item ${
                            lastExportKind === 'all' ? 'is-selected' : ''
                          }`}
                          title="Download all formats (CSV, JSON, Markdown)"
                          aria-label="Download all formats: CSV, JSON, and Markdown"
                          onClick={() => {
                            setLastExportKind('all')
                            exportCSV()
                            exportJSON()
                            exportMarkdown()
                            closeExportMenu()
                          }}
                        >
                          <span className="export-menu__check" aria-hidden="true">
                            {lastExportKind === 'all' ? '✓' : ''}
                          </span>
                          <span className="export-menu__label">All formats</span>
                        </button>
                      </li>
                    </ul>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn--match-action btn--icon-action"
                onClick={clearResults}
                aria-label="Clear all results in this run"
                title="Clear all results in this run"
              >
                <span className="response-action-icon response-action-icon--clear response-action-icon--btn-tone" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="results-list">
            {results.map((result, idx) => (
              <article key={`${result.modelId}-${idx}`} className={`response-card status-${result.status}`}>
                <header className="response-header">
                  <div className={`response-badge ${responseStatusBadgeClass(result.status)}`}>
                    <span
                      className={`status-icon ${
                        result.status === 'pass'
                          ? 'status-icon--pass'
                          : result.status === 'fail' || result.status === 'fail_story'
                            ? 'status-icon--fail'
                            : result.status === 'error'
                              ? 'status-icon--error'
                              : ''
                      }`}
                    >
                      {result.status === 'pass'
                        ? '✓'
                        : result.status === 'fail' || result.status === 'fail_story'
                          ? '✗'
                          : result.status === 'error'
                            ? '⚠'
                            : '?'}
                    </span>
                  </div>
                  <div className="response-title">
                    <h3>{result.modelName}</h3>
                    <div className="response-meta">
                    {[
                      result.latencyMs !== null ? `${result.latencyMs}ms` : null,
                      replyStatusLine(result.status),
                      result.reason || null,
                      result.apiFinishReason ? `API finish: ${result.apiFinishReason}` : null,
                      result.completionTokens != null ? `${result.completionTokens} completion tokens` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    </div>
                  </div>
                  <div className="response-actions">
                    {!result.response.trim() ? (
                      <>
                        {retryingModels.includes(result.modelId) ? (
                          <span className="response-retry-label" aria-live="polite">
                            Retrying…
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className={`copy-icon-btn copy-icon-btn--response${
                            retryingModels.includes(result.modelId) ? ' copy-icon-btn--response-retrying' : ''
                          }`}
                          onClick={() => void retryModelPrompt(result.modelId)}
                          disabled={!hasPromptToRetry || retryingModels.includes(result.modelId)}
                          aria-label={`Resend test prompt to ${result.modelName}`}
                          title={
                            retryingModels.includes(result.modelId)
                              ? 'Retry in progress…'
                              : !hasPromptToRetry
                                ? 'Enter a prompt in section 3 to resend'
                                : 'Send the current test prompt to this model again'
                          }
                        >
                          <span className="response-action-icon response-action-icon--retry" aria-hidden="true" />
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="copy-icon-btn copy-icon-btn--response"
                      onClick={() => openContinueChat(result)}
                      aria-label={`Continue chat with ${result.modelName}`}
                      title="Continue chat"
                    >
                      <span className="response-action-icon response-action-icon--continue-chat" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="copy-icon-btn copy-icon-btn--response"
                      onClick={() =>
                        copyText(
                          result.error
                            ? `Error: ${result.error}`
                            : result.response.trim()
                              ? result.response
                              : '(empty response)',
                          `result-${result.modelId}-${idx}`
                        )
                      }
                      aria-label={`Copy output from ${result.modelName}`}
                      title="Copy output"
                    >
                      {copiedKey === `result-${result.modelId}-${idx}` ? (
                        '✓'
                      ) : (
                        <span className="response-action-icon response-action-icon--copy" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </header>
                {result.error ? (
                  <div className="response-error">Error: {result.error}</div>
                ) : (
                  <div className="scroll-fade-shell scroll-fade-shell--reply">
                    <div className="scroll-fade-viewport scroll-fade-viewport--reply">
                      <pre className="reply-window">{result.response.trim() ? result.response : '(empty response)'}</pre>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
