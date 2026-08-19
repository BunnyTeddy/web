import { describe, expect, it } from 'vitest'

import { normalizedFixtureReports } from '@/data/fixtureReports'
import { filterFindingRecords, filterFindings } from '@/domain/findingFilters'
import type { FindingRecord } from '@/domain/types'

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

  it('searches global records by project and source file and filters by project', () => {
    const records: FindingRecord[] = normalizedFixtureReports.flatMap((report) =>
      report.findings.map((finding) => ({
        key: `${report.scanId}:${finding.id}`,
        finding,
        scanId: report.scanId,
        projectName: report.projectName,
        projectSlug: report.projectSlug,
        scanStartedAt: report.metadata.startedAt,
        scanFinishedAt: report.metadata.finishedAt,
        sourceJobId: report.scanId,
      })),
    )

    const projectMatches = filterFindingRecords(records, {
      query: 'JobCV Backend',
      project: 'jobcv-backend',
      severity: null,
      tool: null,
      category: null,
    })
    expect(projectMatches.length).toBeGreaterThan(0)
    expect(projectMatches.every((record) => record.projectSlug === 'jobcv-backend')).toBe(true)

    const sourceFile = records.find((record) => record.finding.locations[0])?.finding.locations[0]
      ?.file
    expect(sourceFile).toBeTruthy()
    const sourceMatches = filterFindingRecords(records, {
      query: sourceFile ?? '',
      project: null,
      severity: null,
      tool: null,
      category: null,
    })
    expect(
      sourceMatches.some((record) =>
        record.finding.locations.some((location) => location.file === sourceFile),
      ),
    ).toBe(true)
  })

  it('sorts same-severity records by latest scan and then rule id', () => {
    const finding = normalizedFixtureReports[0]?.findings.find(
      (candidate) => candidate.severity === 'high',
    )
    expect(finding).toBeTruthy()
    if (!finding) return

    const records: FindingRecord[] = [
      {
        key: `older:${finding.id}`,
        finding: { ...finding, ruleId: 'RULE-Z' },
        scanId: 'older',
        projectName: 'Older Project',
        projectSlug: 'older-project',
        scanStartedAt: '2026-01-01T00:00:00Z',
        scanFinishedAt: '2026-01-01T01:00:00Z',
        sourceJobId: null,
      },
      {
        key: `newer-b:${finding.id}`,
        finding: { ...finding, ruleId: 'RULE-B' },
        scanId: 'newer-b',
        projectName: 'Newer Project',
        projectSlug: 'newer-project',
        scanStartedAt: '2026-02-01T00:00:00Z',
        scanFinishedAt: '2026-02-01T01:00:00Z',
        sourceJobId: null,
      },
      {
        key: `newer-a:${finding.id}`,
        finding: { ...finding, ruleId: 'RULE-A' },
        scanId: 'newer-a',
        projectName: 'Newer Project',
        projectSlug: 'newer-project-2',
        scanStartedAt: '2026-02-01T00:00:00Z',
        scanFinishedAt: '2026-02-01T01:00:00Z',
        sourceJobId: null,
      },
    ]

    const result = filterFindingRecords(records, {
      query: '',
      project: null,
      severity: null,
      tool: null,
      category: null,
    })
    expect(result.map((record) => record.finding.ruleId)).toEqual([
      'RULE-A',
      'RULE-B',
      'RULE-Z',
    ])
  })
})
