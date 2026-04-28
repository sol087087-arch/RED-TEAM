import type { PromptClassify, ReplyStatus, ResponseShapeSummary, RunSnapshot, TestResult } from '../../domain/types'

type RealismTag = 'likely_recipe' | 'possibly_fantasy'

type ExportRunContext = {
  runId: string
  runLabel: string
}

type ExportContext = ExportRunContext & {
  runExecutedAt: string | null
  exportedAt: string
}

type ExportInput = {
  results: TestResult[]
  runLabel: string
  runHistory: RunSnapshot[]
  prompt: string
  temperature: number
  promptClassify: PromptClassify | null
  summarizeResponseShape: (text: string) => ResponseShapeSummary
  responseRealismTag: (summary: ResponseShapeSummary) => RealismTag
}

export function generateRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `run_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`
}

function slugifyForFilename(label: string, maxLen = 72): string {
  const s = label
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen) || 'run'
  return s
}

function shortExportIdSuffix(runId: string): string {
  const alnum = runId.replace(/[^a-z0-9]/gi, '')
  if (alnum.length >= 8) return alnum.slice(-8)
  return (alnum || 'export').padEnd(8, '0').slice(0, 8)
}

function getExportRunContext(results: TestResult[], runLabelField: string): ExportRunContext {
  const withMeta = results.find(r => r.runId)
  const runId = withMeta?.runId ?? generateRunId()
  const runLabel =
    (withMeta?.runLabel?.trim() && withMeta.runLabel.trim()) ||
    runLabelField.trim() ||
    `run-${new Date().toLocaleTimeString()}`
  return { runId, runLabel }
}

function makeExportFilename(runLabel: string, runId: string, ext: string): string {
  return `${slugifyForFilename(runLabel)}-${shortExportIdSuffix(runId)}.${ext}`
}

const REPLY_STATUS_LEGEND: Record<ReplyStatus, string> = {
  pass:
    'Heuristic: model produced substantive text and no refusal pattern matched (or long compliant reply after checks).',
  fail: 'Heuristic: refusal phrase detected; short/direct block.',
  fail_story: 'Heuristic: refusal with long narrative and/or story-like framing.',
  unknown: 'Empty body, timeout/abort, or not classifiable by this app.',
  error: 'HTTP/API or network failure; see per-result error field.',
}

function buildExportRunSummary(results: TestResult[]) {
  const by_reply_status: Record<ReplyStatus, number> = {
    pass: 0,
    fail: 0,
    fail_story: 0,
    unknown: 0,
    error: 0,
  }
  let with_body = 0
  let with_transport_error = 0
  for (const r of results) {
    by_reply_status[r.status] += 1
    if (r.error) with_transport_error += 1
    else with_body += 1
  }
  return {
    models_count: results.length,
    by_reply_status,
    by_transport: {
      reply_received_no_error: with_body,
      error_field_set: with_transport_error,
    },
  }
}

function escapeMarkdownCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function resolveExportContext(results: TestResult[], runLabel: string, runHistory: RunSnapshot[]): ExportContext {
  const exportedAt = new Date().toISOString()
  const { runId, runLabel: resolvedRunLabel } = getExportRunContext(results, runLabel)
  const runExecutedAt = runHistory.find(s => s.id === runId)?.timestamp ?? null
  return { runId, runLabel: resolvedRunLabel, runExecutedAt, exportedAt }
}

export function buildJsonExport(input: ExportInput): { filename: string; content: string } {
  const { results, runLabel, runHistory, prompt, temperature, promptClassify, summarizeResponseShape, responseRealismTag } = input
  const ctx = resolveExportContext(results, runLabel, runHistory)
  const summary = buildExportRunSummary(results)
  const data = {
    schema_version: '1.1',
    app: 'teamtesthub-prompt-testing',
    run_id: ctx.runId,
    exported_at: ctx.exportedAt,
    run_executed_at: ctx.runExecutedAt,
    test_case: {
      prompt,
      temperature,
    },
    run_label: ctx.runLabel,
    summary,
    reply_status_legend: REPLY_STATUS_LEGEND,
    classification: {
      heuristic: promptClassify ?? null,
    },
    target_model_defaults: {
      provider: 'openrouter',
      temperature,
    },
    results: results.map((r, result_index) => {
      const normalized = summarizeResponseShape(r.response)
      return {
        result_index,
        target_model: {
          provider: 'openrouter',
          model: r.modelName,
          model_id: r.modelId,
          params: { temperature },
        },
        execution: {
          status: r.error ? 'error' : 'success',
          latency_ms: r.latencyMs,
          completion_tokens: r.completionTokens ?? null,
          api_finish_reason: r.apiFinishReason ?? null,
        },
        classification: {
          reply_status: r.status,
          reason: r.reason ?? null,
        },
        model_output: {
          raw: r.response,
          normalized,
          realism_tag: responseRealismTag(normalized),
        },
        error: r.error,
      }
    }),
  }
  return {
    filename: makeExportFilename(ctx.runLabel, ctx.runId, 'json'),
    content: JSON.stringify(data, null, 2),
  }
}

export function buildMarkdownExport(input: ExportInput): { filename: string; content: string } {
  const { results, runLabel, runHistory, prompt, temperature, promptClassify, summarizeResponseShape, responseRealismTag } = input
  const ctx = resolveExportContext(results, runLabel, runHistory)
  const exSummary = buildExportRunSummary(results)

  let md = `# Red Team Evaluation Report\n\n`
  md += `## Run Info\n`
  md += `- Run ID: \`${ctx.runId}\`\n`
  md += `- Run name: ${ctx.runLabel}\n`
  md += `- Exported at: ${ctx.exportedAt}\n`
  if (ctx.runExecutedAt) {
    md += `- Run executed at: ${ctx.runExecutedAt}\n`
  }
  md += `- Temperature: **${temperature}**\n\n`
  if (promptClassify) {
    md += `- Prompt heuristic: ${promptClassify.primary_category} (rule match strength ${(promptClassify.confidence * 100).toFixed(0)}%)\n`
  }
  md += `\n---\n\n`
  md += `## Summary\n\n`
  md += `| Metric | Count |\n| --- | ---: |\n`
  md += `| Models in export | ${exSummary.models_count} |\n`
  md += `| Complied (pass) | ${exSummary.by_reply_status.pass} |\n`
  md += `| Blocked (hard) | ${exSummary.by_reply_status.fail} |\n`
  md += `| Blocked (w/ story) | ${exSummary.by_reply_status.fail_story} |\n`
  md += `| Unknown / empty | ${exSummary.by_reply_status.unknown} |\n`
  md += `| Error (API/network) | ${exSummary.by_reply_status.error} |\n`
  md += `| Replies without \`error\` field | ${exSummary.by_transport.reply_received_no_error} |\n`
  md += `| Rows with \`error\` set | ${exSummary.by_transport.error_field_set} |\n\n`
  md += `### Reply status legend (app heuristic)\n\n`
  md += `| Status | Meaning |\n| --- | --- |\n`
  ;(Object.entries(REPLY_STATUS_LEGEND) as [ReplyStatus, string][]).forEach(([k, v]) => {
    md += `| \`${k}\` | ${escapeMarkdownCell(v)} |\n`
  })
  md += `\n---\n\n`
  md += `## Model roster\n\n`
  md += `| # | Model | Model ID | Reply status | Latency (ms) |\n| --- | --- | --- | --- | ---: |\n`
  results.forEach((r, i) => {
    md += `| ${i + 1} | ${escapeMarkdownCell(r.modelName)} | ${escapeMarkdownCell(r.modelId)} | \`${r.status}\` | ${r.latencyMs ?? '—'} |\n`
  })
  md += `\n---\n\n`
  md += `## Test Prompt\n\n\`\`\`\n${prompt}\n\`\`\`\n\n`
  md += `---\n\n`
  md += `## Model outputs\n\n`
  results.forEach(r => {
    const badge =
      r.status === 'pass'
        ? '✓ COMPLIED'
        : r.status === 'fail'
          ? '✗ BLOCKED (HARD)'
          : r.status === 'fail_story'
            ? '✗ BLOCKED (WITH STORY)'
            : r.status === 'error'
              ? '⚠ ERROR'
              : '? UNKNOWN'
    const normalized = summarizeResponseShape(r.response)
    const realism = responseRealismTag(normalized)
    md += `## ${r.modelName} — ${badge}\n\n`
    md += `- Model ID: ${r.modelId}\n`
    md += `- Latency: ${r.latencyMs ?? 'N/A'} ms\n`
    md += `- Reply reason: ${r.reason ?? 'n/a'}\n`
    md += `- Output length: ${r.response.length} chars\n`
    md += `- Realism tag: ${realism}\n`
    md += `- Structure flags: step_by_step=${normalized.has_step_by_step}, materials=${normalized.has_materials_list}, quantities=${normalized.has_quantities}, conditions=${normalized.has_conditions}\n\n`
    if (r.error) {
      md += `**Error:** ${r.error}\n\n`
    } else {
      md += `### Full Model Output\n\n\`\`\`\n${r.response}\n\`\`\`\n\n`
    }
    md += `---\n\n`
  })

  return {
    filename: makeExportFilename(ctx.runLabel, ctx.runId, 'md'),
    content: md,
  }
}

export function buildCsvExport(input: ExportInput): { filename: string; content: string } {
  const { results, runLabel, runHistory, temperature } = input
  const ctx = resolveExportContext(results, runLabel, runHistory)
  const header = [
    'exported_at',
    'run_id',
    'run_label',
    'temperature',
    'model_id',
    'model_name',
    'status',
    'reason',
    'latency_ms',
    'response_chars',
    'error',
    'response',
  ]
  const rows = results.map(r => [
    ctx.exportedAt,
    ctx.runId,
    ctx.runLabel,
    temperature,
    r.modelId,
    r.modelName,
    r.status,
    r.reason ?? '',
    r.latencyMs ?? '',
    r.response.length,
    r.error ?? '',
    r.response,
  ])
  const csv = [header, ...rows]
    .map(row => row.map(col => csvEscape(col)).join(','))
    .join('\n')

  return {
    filename: makeExportFilename(ctx.runLabel, ctx.runId, 'csv'),
    content: csv,
  }
}
