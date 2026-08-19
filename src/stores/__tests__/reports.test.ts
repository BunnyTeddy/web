import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { normalizedFixtureReports } from '@/data/fixtureReports'
import type { ScanJob, ScanReport } from '@/domain/types'
import { emptySeverityCounts } from '@/domain/types'

const clientMocks = vi.hoisted(() => ({
  listScans: vi.fn(),
  getReport: vi.fn(),
}))

vi.mock('@/services/client', () => ({
  secSourceClient: clientMocks,
}))

import {
  findingRecordsForReports,
  latestReportsByProject,
  useReportsStore,
} from '@/stores/reports'

function cloneReport(
  source: ScanReport,
  scanId: string,
  finishedAt: string,
  projectSlug = source.projectSlug,
): ScanReport {
  const findings = source.findings.map((finding) => ({ ...finding, scanId }))
  return {
    ...source,
    scanId,
    projectSlug,
    metadata: { ...source.metadata, scanId, finishedAt },
    findings,
    severityCounts: { ...source.severityCounts },
  }
}

function completedJob(report: ScanReport, id = `job-${report.scanId}`): ScanJob {
  return {
    id,
    projectName: report.projectName,
    projectPath: `/workspace/${report.projectSlug}`,
    mode: report.metadata.mode,
    format: 'json',
    force: false,
    status: 'completed',
    progress: 100,
    createdAt: report.metadata.startedAt,
    startedAt: report.metadata.startedAt,
    finishedAt: report.metadata.finishedAt,
    findingCount: report.findings.length,
    severityCounts: { ...report.severityCounts },
    activity: [],
    error: null,
    reportScanId: report.scanId,
  }
}

describe('reports store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    clientMocks.listScans.mockReset()
    clientMocks.getReport.mockReset()
  })

  it('selects only the newest report per project and aggregates current totals', async () => {
    const source = normalizedFixtureReports[0]!
    const otherProject = normalizedFixtureReports[1]!
    const older = cloneReport(source, 'same-project-older', '2026-07-01T10:00:00Z')
    const newer = cloneReport(source, 'same-project-newer', '2026-08-18T10:00:00Z')
    const jobs = [completedJob(older), completedJob(newer), completedJob(otherProject)]
    const byId = new Map([older, newer, otherProject].map((report) => [report.scanId, report]))
    clientMocks.listScans.mockResolvedValue(jobs)
    clientMocks.getReport.mockImplementation(async (scanId: string) => byId.get(scanId))

    const store = useReportsStore()
    await store.initialize()

    expect(store.latestReports.map((report) => report.scanId)).toContain('same-project-newer')
    expect(store.latestReports.map((report) => report.scanId)).not.toContain('same-project-older')
    expect(store.latestTotals.total).toBe(newer.findings.length + otherProject.findings.length)
    expect(store.totals).toEqual(store.latestTotals)
  })

  it('uses a composite report/finding key and preserves source job context', () => {
    const source = normalizedFixtureReports[0]!
    const first = cloneReport(source, 'scan-one', '2026-08-17T10:00:00Z', 'project-one')
    const second = cloneReport(source, 'scan-two', '2026-08-18T10:00:00Z', 'project-two')
    first.findings = first.findings.slice(0, 1)
    second.findings = second.findings.slice(0, 1)

    const records = findingRecordsForReports([first, second], {
      'scan-one': 'job-one',
      'scan-two': 'job-two',
    })

    expect(records).toHaveLength(2)
    expect(records[0]?.finding.id).toBe(records[1]?.finding.id)
    expect(new Set(records.map((record) => record.key)).size).toBe(2)
    expect(records.map((record) => record.sourceJobId)).toEqual(['job-one', 'job-two'])
  })

  it('keeps valid reports when one report fails to load', async () => {
    const valid = normalizedFixtureReports[0]!
    const missing: ScanReport = {
      ...valid,
      scanId: 'missing-report',
      projectName: 'Missing Project',
      projectSlug: 'missing-project',
      metadata: { ...valid.metadata, scanId: 'missing-report' },
      findings: [],
      severityCounts: emptySeverityCounts(),
    }
    clientMocks.listScans.mockResolvedValue([
      completedJob(valid, 'valid-job'),
      completedJob(missing, 'missing-job'),
    ])
    clientMocks.getReport.mockImplementation(async (scanId: string) => {
      if (scanId === valid.scanId) return valid
      throw new Error('Report payload is malformed')
    })

    const store = useReportsStore()
    await store.initialize()

    expect(store.initialized).toBe(true)
    expect(store.error).toBeNull()
    expect(store.reports.map((report) => report.scanId)).toEqual([valid.scanId])
    expect(store.reportWarningCount).toBe(1)
    expect(store.reportLoadErrors['missing-report']).toBe('Report payload is malformed')
  })

  it('falls back to startedAt when finishedAt is unavailable', () => {
    const source = normalizedFixtureReports[0]!
    const older = cloneReport(source, 'older-start', '', source.projectSlug)
    older.metadata.startedAt = '2026-08-01T10:00:00Z'
    const newer = cloneReport(source, 'newer-start', '', source.projectSlug)
    newer.metadata.startedAt = '2026-08-02T10:00:00Z'

    expect(latestReportsByProject([older, newer])[0]?.scanId).toBe('newer-start')
  })
})
