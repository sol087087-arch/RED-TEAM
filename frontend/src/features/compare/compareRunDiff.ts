import type { RunSnapshot, TestResult } from '../../domain/types'

export type CompareRunSideRow = {
  modelId: string
  label: string
  statusBaseline: TestResult['status'] | null
  statusCompare: TestResult['status'] | null
}

function compactModelLabel(modelName: string, modelId: string): string {
  const raw = modelName.trim()
  const provider = modelId.includes('/') ? modelId.split('/')[0].toLowerCase() : ''
  const m = raw.match(/^([A-Za-z0-9 _-]+):\s*(.+)$/)
  if (!m) return raw || modelId
  const prefix = m[1].trim().toLowerCase()
  const rest = m[2].trim()
  if (provider && prefix === provider && rest) return rest
  return raw || modelId
}

/** One row per model (union of both runs), sorted by display name. */
export function buildCompareRunSideByRows(a: RunSnapshot, b: RunSnapshot): CompareRunSideRow[] {
  const mapA = new Map(a.results.map(r => [r.modelId, r]))
  const mapB = new Map(b.results.map(r => [r.modelId, r]))
  const ids = new Set<string>([...mapA.keys(), ...mapB.keys()])
  const rows: CompareRunSideRow[] = []

  for (const id of ids) {
    const ra = mapA.get(id)
    const rb = mapB.get(id)
    const modelName = (rb?.modelName?.trim() || ra?.modelName?.trim() || id).trim()
    const label = compactModelLabel(modelName, id)
    rows.push({
      modelId: id,
      label,
      statusBaseline: ra?.status ?? null,
      statusCompare: rb?.status ?? null,
    })
  }

  rows.sort((x, y) => x.label.localeCompare(y.label) || x.modelId.localeCompare(y.modelId))
  return rows
}
