import type { Finding, FindingRecord, Severity } from '@/domain/types'

export interface FindingFilters {
  query: string
  severity: Severity | null
  tool: string | null
  category: string | null
}

export interface FindingRecordFilters extends FindingFilters {
  project: string | null
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
}

function searchableFindingValues(finding: Finding): Array<string | null | undefined> {
  return [
    finding.ruleId,
    finding.message,
    finding.tool,
    finding.category,
    finding.dependency?.name,
    finding.dependency?.sourceFile,
    ...finding.locations.map((location) => location.file),
  ]
}

function matchesFinding(finding: Finding, filters: FindingFilters, extraValues: string[] = []) {
  if (filters.severity && finding.severity !== filters.severity) return false
  if (filters.tool && finding.tool !== filters.tool) return false
  if (filters.category && finding.category !== filters.category) return false

  const needle = filters.query.trim().toLowerCase()
  if (!needle) return true

  return [...searchableFindingValues(finding), ...extraValues]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.toLowerCase().includes(needle))
}

function timestamp(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Kept for consumers that only have normalized findings from one report. */
export function filterFindings(findings: Finding[], filters: FindingFilters): Finding[] {
  return findings
    .filter((finding) => matchesFinding(finding, filters))
    .sort(
      (left, right) =>
        SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] ||
        left.ruleId.localeCompare(right.ruleId),
    )
}

/** Filter and deterministically order the global, report-aware findings list. */
export function filterFindingRecords(
  records: FindingRecord[],
  filters: FindingRecordFilters,
): FindingRecord[] {
  return records
    .filter((record) => !filters.project || record.projectSlug === filters.project)
    .filter((record) =>
      matchesFinding(record.finding, filters, [record.projectName, record.projectSlug]),
    )
    .sort(
      (left, right) =>
        SEVERITY_RANK[left.finding.severity] - SEVERITY_RANK[right.finding.severity] ||
        timestamp(right.scanFinishedAt || right.scanStartedAt) -
          timestamp(left.scanFinishedAt || left.scanStartedAt) ||
        left.finding.ruleId.localeCompare(right.finding.ruleId),
    )
}
