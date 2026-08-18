import type { Finding, Severity } from '@/domain/types'

export interface FindingFilters {
  query: string
  severity: Severity | null
  tool: string | null
  category: string | null
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
}

export function filterFindings(findings: Finding[], filters: FindingFilters): Finding[] {
  const needle = filters.query.trim().toLowerCase()

  return findings
    .filter((finding) => !filters.severity || finding.severity === filters.severity)
    .filter((finding) => !filters.tool || finding.tool === filters.tool)
    .filter((finding) => !filters.category || finding.category === filters.category)
    .filter((finding) => {
      if (!needle) return true
      return [
        finding.ruleId,
        finding.message,
        finding.tool,
        finding.category,
        finding.dependency?.name,
      ]
        .filter((value): value is string => typeof value === 'string')
        .some((value) => value.toLowerCase().includes(needle))
    })
    .sort((left, right) => SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity])
}
