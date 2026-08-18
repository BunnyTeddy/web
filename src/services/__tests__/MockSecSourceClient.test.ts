import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HISTORICAL_SCAN_JOBS } from '@/data/historicalScanJobs'
import { severityTotal } from '@/domain/types'
import { MockSecSourceClient } from '@/services/MockSecSourceClient'

describe('MockSecSourceClient', () => {
  let client: MockSecSourceClient

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-18T10:00:00.000Z'))
    client = new MockSecSourceClient({
      lifecycleDelays: { uploading: 100, running: 200, completed: 300 },
    })
  })

  afterEach(() => {
    client.dispose()
    vi.useRealTimers()
  })

  it('starts with three fixture jobs followed by ten deterministic historical jobs', async () => {
    const jobs = await client.listScans()
    const reportBackedJobs = jobs.filter((job) => job.reportScanId !== null)
    const historicalJobs = jobs.filter((job) => job.id.startsWith('history-'))

    expect(jobs).toHaveLength(13)
    expect(new Set(jobs.map((job) => job.id))).toHaveLength(13)
    expect(jobs.map((job) => job.createdAt)).toEqual(
      [...jobs.map((job) => job.createdAt)].sort((left, right) => right.localeCompare(left)),
    )

    expect(reportBackedJobs).toHaveLength(3)
    expect(reportBackedJobs.every((job) => job.status === 'completed')).toBe(true)
    expect(reportBackedJobs.reduce((count, job) => count + job.findingCount, 0)).toBe(153)

    expect(HISTORICAL_SCAN_JOBS).toHaveLength(10)
    expect(historicalJobs).toHaveLength(10)
    expect(historicalJobs.every((job) => job.reportScanId === null)).toBe(true)
    expect(historicalJobs.every((job) => job.createdAt < '2026-08-17T00:00:00.000Z')).toBe(true)
    expect(new Set(historicalJobs.map((job) => job.status))).toEqual(
      new Set(['completed', 'failed', 'cancelled']),
    )
    expect(new Set(historicalJobs.map((job) => job.mode))).toEqual(
      new Set(['auto', 'deep', 'shallow']),
    )
    expect(
      historicalJobs.every(
        (job) =>
          job.startedAt !== null &&
          job.finishedAt !== null &&
          job.createdAt <= job.startedAt &&
          job.startedAt <= job.finishedAt,
      ),
    ).toBe(true)
    expect(
      historicalJobs
        .filter((job) => job.status === 'completed')
        .every(
          (job) =>
            job.progress === 100 &&
            job.error === null &&
            job.activity.includes('Detailed report is no longer available'),
        ),
    ).toBe(true)
    expect(
      historicalJobs
        .filter((job) => job.status === 'failed')
        .every((job) => job.progress < 100 && Boolean(job.error)),
    ).toBe(true)
    expect(
      historicalJobs.every((job) => severityTotal(job.severityCounts) === job.findingCount),
    ).toBe(true)
  })

  it('moves a demo scan deterministically through its lifecycle', async () => {
    const created = await client.createScan({
      projectPath: '/workspace/acme-api',
      mode: 'deep',
      format: 'json',
      force: true,
    })
    expect(created).toMatchObject({
      id: 'local-scan-001',
      projectName: 'Acme Api',
      status: 'queued',
      progress: 4,
    })

    await vi.advanceTimersByTimeAsync(100)
    expect((await client.listScans()).find((job) => job.id === created.id)).toMatchObject({
      status: 'uploading',
      progress: 24,
    })

    await vi.advanceTimersByTimeAsync(100)
    expect((await client.listScans()).find((job) => job.id === created.id)).toMatchObject({
      status: 'running',
      progress: 68,
    })

    await vi.advanceTimersByTimeAsync(100)
    const completed = (await client.listScans()).find((job) => job.id === created.id)
    expect(completed).toMatchObject({
      status: 'completed',
      progress: 100,
      reportScanId: created.id,
      findingCount: 84,
    })
    await expect(client.getReport(created.id)).resolves.toMatchObject({
      scanId: created.id,
      projectName: 'Acme Api',
    })
  })

  it('cancels an active scan and prevents later timer transitions', async () => {
    const created = await client.createScan({
      projectPath: '/workspace/cancellable',
      mode: 'auto',
      format: 'sarif',
      force: false,
    })
    await vi.advanceTimersByTimeAsync(100)

    const cancelled = await client.cancelScan(created.id)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.activity.at(-1)).toBe('Scan cancelled by user')

    await vi.advanceTimersByTimeAsync(1_000)
    const current = (await client.listScans()).find((job) => job.id === created.id)
    expect(current?.status).toBe('cancelled')
    await expect(client.getReport(created.id)).rejects.toThrow('not available')
  })

  it('keeps secrets out of stored settings', async () => {
    await client.login({
      mode: 'token',
      serverUrl: 'https://scanner.example.test',
      token: 'super-secret-token',
    })

    const settings = await client.getSettings()
    expect(settings).not.toHaveProperty('token')
    expect(JSON.stringify(settings)).not.toContain('super-secret-token')
  })
})
