import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { aggregateReportTotals } from '@/data/normalizeReport'
import type { Finding, FindingRecord, ScanJob, ScanReport } from '@/domain/types'
import { secSourceClient } from '@/services/client'

function reportTimestamp(report: ScanReport): number {
  const candidate = report.metadata.finishedAt || report.metadata.startedAt
  const parsed = Date.parse(candidate)
  return Number.isFinite(parsed) ? parsed : 0
}

export function latestReportsByProject(reports: ScanReport[]): ScanReport[] {
  const latest = new Map<string, ScanReport>()

  for (const report of reports) {
    const current = latest.get(report.projectSlug)
    if (!current || reportTimestamp(report) > reportTimestamp(current)) {
      latest.set(report.projectSlug, report)
    }
  }

  return [...latest.values()].sort((left, right) => reportTimestamp(right) - reportTimestamp(left))
}

function reportJobMap(jobs: ScanJob[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const job of jobs) {
    if (job.reportScanId) result[job.reportScanId] = job.id
  }
  return result
}

export function findingRecordsForReports(
  reports: ScanReport[],
  sourceJobs: Record<string, string> = {},
): FindingRecord[] {
  return reports.flatMap((report) =>
    report.findings.map((finding) => ({
      key: `${report.scanId}:${finding.id}`,
      finding,
      scanId: report.scanId,
      projectName: report.projectName,
      projectSlug: report.projectSlug,
      scanStartedAt: report.metadata.startedAt,
      scanFinishedAt: report.metadata.finishedAt,
      sourceJobId: sourceJobs[report.scanId] ?? null,
    })),
  )
}

export const useReportsStore = defineStore('reports', () => {
  const reports = ref<ScanReport[]>([])
  const sourceJobIds = ref<Record<string, string>>({})
  const reportLoadErrors = ref<Record<string, string>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  const latestReports = computed(() => latestReportsByProject(reports.value))
  const latestTotals = computed(() => aggregateReportTotals(latestReports.value))
  // `totals` remains the public overview API, now using one current report per project.
  const totals = latestTotals
  const allFindingRecords = computed(() =>
    findingRecordsForReports(reports.value, sourceJobIds.value),
  )
  const latestFindingRecords = computed(() =>
    findingRecordsForReports(latestReports.value, sourceJobIds.value),
  )
  const allFindings = computed<Finding[]>(() =>
    latestFindingRecords.value.map((record) => record.finding),
  )
  const reportWarningCount = computed(() => Object.keys(reportLoadErrors.value).length)

  function getReport(scanId: string): ScanReport | undefined {
    return reports.value.find((report) => report.scanId === scanId)
  }

  function getFinding(scanId: string, findingId?: string): Finding | undefined {
    const report = getReport(scanId)
    if (!report) return undefined
    if (!findingId) return report.findings[0]
    return report.findings.find((finding) => finding.id === findingId)
  }

  function getFindingRecord(scanId: string, findingId?: string): FindingRecord | undefined {
    const records = allFindingRecords.value.filter((record) => record.scanId === scanId)
    if (!findingId) return records[0]
    return records.find((record) => record.finding.id === findingId)
  }

  function getSourceJobId(scanId: string): string | null {
    return sourceJobIds.value[scanId] ?? null
  }

  async function loadReport(scanId: string): Promise<ScanReport> {
    const existing = getReport(scanId)
    if (existing) return existing
    try {
      const report = await secSourceClient.getReport(scanId)
      reports.value.push(report)
      const nextErrors = { ...reportLoadErrors.value }
      delete nextErrors[scanId]
      reportLoadErrors.value = nextErrors
      return report
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : `Unable to load report ${scanId}`
      reportLoadErrors.value = { ...reportLoadErrors.value, [scanId]: message }
      throw cause
    }
  }

  async function initialize(force = false): Promise<void> {
    if ((!force && initialized.value) || loading.value) return
    loading.value = true
    error.value = null
    try {
      const jobs = await secSourceClient.listScans()
      sourceJobIds.value = reportJobMap(jobs)
      const reportIds = [...new Set(jobs
        .map((job) => job.reportScanId)
        .filter((scanId): scanId is string => scanId !== null))]

      const existingIds = new Set(reports.value.map((report) => report.scanId))
      const missingIds = reportIds.filter((scanId) => !existingIds.has(scanId))
      const results = await Promise.allSettled(
        missingIds.map(async (scanId) => ({ scanId, report: await secSourceClient.getReport(scanId) })),
      )
      const nextErrors: Record<string, string> = {}
      const loaded: ScanReport[] = []

      for (const [index, result] of results.entries()) {
        const scanId = missingIds[index]
        if (!scanId) continue
        if (result.status === 'fulfilled') loaded.push(result.value.report)
        else {
          nextErrors[scanId] =
            result.reason instanceof Error ? result.reason.message : `Unable to load report ${scanId}`
        }
      }

      reports.value = [
        ...reports.value.filter((report) => reportIds.includes(report.scanId)),
        ...loaded,
      ]
      reportLoadErrors.value = nextErrors
      initialized.value = true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Unable to load scan reports'
    } finally {
      loading.value = false
    }
  }

  return {
    reports,
    sourceJobIds,
    reportLoadErrors,
    loading,
    error,
    initialized,
    totals,
    latestReports,
    latestTotals,
    allFindingRecords,
    latestFindingRecords,
    allFindings,
    reportWarningCount,
    initialize,
    loadReport,
    getReport,
    getFinding,
    getFindingRecord,
    getSourceJobId,
  }
})
