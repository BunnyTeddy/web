import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { aggregateReportTotals } from '@/data/normalizeReport'
import type { Finding, ScanReport } from '@/domain/types'
import { secSourceClient } from '@/services/client'

export const useReportsStore = defineStore('reports', () => {
  const reports = ref<ScanReport[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  const totals = computed(() => aggregateReportTotals(reports.value))
  const allFindings = computed<Finding[]>(() =>
    reports.value.flatMap((report) => report.findings),
  )

  function getReport(scanId: string): ScanReport | undefined {
    return reports.value.find((report) => report.scanId === scanId)
  }

  function getFinding(scanId: string, findingId?: string): Finding | undefined {
    const report = getReport(scanId)
    if (!report) return undefined
    if (!findingId) return report.findings[0]
    return report.findings.find((finding) => finding.id === findingId)
  }

  async function loadReport(scanId: string): Promise<ScanReport> {
    const existing = getReport(scanId)
    if (existing) return existing
    const report = await secSourceClient.getReport(scanId)
    reports.value.push(report)
    return report
  }

  async function initialize(): Promise<void> {
    if (initialized.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      const jobs = await secSourceClient.listScans()
      const reportIds = jobs
        .map((job) => job.reportScanId)
        .filter((scanId): scanId is string => scanId !== null)
      reports.value = await Promise.all(reportIds.map((scanId) => secSourceClient.getReport(scanId)))
      initialized.value = true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Unable to load scan reports'
    } finally {
      loading.value = false
    }
  }

  return {
    reports,
    loading,
    error,
    initialized,
    totals,
    allFindings,
    initialize,
    loadReport,
    getReport,
    getFinding,
  }
})
