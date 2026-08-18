import { describe, expect, it } from 'vitest'

import { normalizedFixtureReports } from '@/data/fixtureReports'
import { filterFindings } from '@/domain/findingFilters'

describe('finding filters', () => {
  const findings = normalizedFixtureReports.flatMap((report) => report.findings)

  it('combines severity, tool, category, and free-text filters', () => {
    const axiosFindings = filterFindings(findings, {
      query: 'axios',
      severity: 'high',
      tool: 'trivy',
      category: 'dependency',
    })

    expect(axiosFindings.length).toBeGreaterThan(0)
    expect(
      axiosFindings.every(
        (finding) =>
          finding.severity === 'high' &&
          finding.tool === 'trivy' &&
          finding.category === 'dependency' &&
          `${finding.ruleId} ${finding.message} ${finding.dependency?.name ?? ''}`
            .toLowerCase()
            .includes('axios'),
      ),
    ).toBe(true)
  })

  it('sorts unfiltered results by severity', () => {
    const filtered = filterFindings(findings, {
      query: '',
      severity: null,
      tool: null,
      category: null,
    })

    expect(filtered[0]?.severity).toBe('critical')
    expect(filtered.at(-1)?.severity).toBe('low')
  })
})
