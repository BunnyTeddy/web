import { describe, expect, it } from 'vitest'

import { filterScanJobs, scanDateThreshold } from '@/domain/scanFilters'
import type { ScanJob } from '@/domain/types'
import { emptySeverityCounts } from '@/domain/types'

function makeJob(overrides: Partial<ScanJob> = {}): ScanJob {
  return {
    id: 'scan-001',
    projectName: 'API Gateway',
    projectPath: '/workspace/api-gateway',
    mode: 'deep',
    format: 'json',
    force: false,
    status: 'completed',
    progress: 100,
    createdAt: '2026-08-18T08:00:00.000Z',
    startedAt: '2026-08-18T08:01:00.000Z',
    finishedAt: '2026-08-18T08:10:00.000Z',
    findingCount: 0,
    severityCounts: emptySeverityCounts(),
    activity: [],
    error: null,
    reportScanId: 'scan-001',
    ...overrides,
  }
}

describe('scan job filters', () => {
  const now = new Date(2026, 7, 19, 12, 0, 0)
  const jobs = [
    makeJob(),
    makeJob({
      id: 'scan-002',
      projectName: 'Customer Portal',
      projectPath: '/workspace/customer-portal',
      mode: 'auto',
      status: 'failed',
      startedAt: '2026-08-10T09:00:00.000Z',
    }),
  ]

  it('combines query, project, status and mode filters', () => {
    expect(
      filterScanJobs(
        jobs,
        {
          query: 'gateway',
          projectPath: '/workspace/api-gateway',
          status: 'completed',
          mode: 'deep',
          date: 'all',
        },
        now,
      ).map((job) => job.id),
    ).toEqual(['scan-001'])
  })

  it('uses local calendar boundaries for date presets', () => {
    expect(scanDateThreshold('today', now)).toBe(new Date(2026, 7, 19).getTime())
    expect(scanDateThreshold('7d', now)).toBe(new Date(2026, 7, 13).getTime())
    expect(scanDateThreshold('30d', now)).toBe(new Date(2026, 6, 21).getTime())
  })

  it('uses startedAt and falls back to createdAt for date filtering', () => {
    const recentCreated = makeJob({
      id: 'scan-created',
      startedAt: null,
      createdAt: '2026-08-19T01:00:00.000Z',
    })
    expect(
      filterScanJobs(
        [...jobs, recentCreated],
        { query: '', projectPath: 'all', status: 'all', mode: 'all', date: 'today' },
        now,
      ).map((job) => job.id),
    ).toEqual(['scan-created'])
  })
})
