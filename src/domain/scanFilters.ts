import type { JobStatus, ScanJob, ScanMode } from '@/domain/types'

export type ScanDatePreset = 'all' | 'today' | '7d' | '30d'

export interface ScanFilters {
  query: string
  projectPath: 'all' | string
  status: 'all' | JobStatus
  mode: 'all' | ScanMode
  date: ScanDatePreset
}

function startOfLocalDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
}

export function scanDateThreshold(preset: ScanDatePreset, now = new Date()): number | null {
  if (preset === 'all') return null

  const daysBack = preset === 'today' ? 0 : preset === '7d' ? 6 : 29
  const threshold = new Date(startOfLocalDay(now))
  threshold.setDate(threshold.getDate() - daysBack)
  return threshold.getTime()
}

export function scanJobTimestamp(job: ScanJob): number | null {
  const timestamp = new Date(job.startedAt ?? job.createdAt).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export function filterScanJobs(
  jobs: readonly ScanJob[],
  filters: ScanFilters,
  now = new Date(),
): ScanJob[] {
  const query = filters.query.trim().toLowerCase()
  const threshold = scanDateThreshold(filters.date, now)

  return jobs.filter((job) => {
    const matchesQuery =
      !query ||
      job.projectName.toLowerCase().includes(query) ||
      job.projectPath.toLowerCase().includes(query) ||
      job.id.toLowerCase().includes(query)
    const matchesProject = filters.projectPath === 'all' || job.projectPath === filters.projectPath
    const matchesStatus = filters.status === 'all' || job.status === filters.status
    const matchesMode = filters.mode === 'all' || job.mode === filters.mode
    const timestamp = threshold === null ? null : scanJobTimestamp(job)
    const matchesDate = threshold === null || (timestamp !== null && timestamp >= threshold)

    return matchesQuery && matchesProject && matchesStatus && matchesMode && matchesDate
  })
}
