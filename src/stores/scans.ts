import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { ScanCreateInput, ScanJob } from '@/domain/types'
import { secSourceClient } from '@/services/client'

const POLL_INTERVAL_MS = 250

function isActive(job: ScanJob): boolean {
  return job.status === 'queued' || job.status === 'uploading' || job.status === 'running'
}

export const useScansStore = defineStore('scans', () => {
  const jobs = ref<ScanJob[]>([])
  const selectedJobId = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const selectedJob = computed<ScanJob | null>(() => {
    if (!selectedJobId.value) return null
    return jobs.value.find((job) => job.id === selectedJobId.value) ?? null
  })
  const activeJobs = computed(() => jobs.value.filter(isActive))

  function selectJob(jobId: string | null): void {
    selectedJobId.value = jobId
  }

  async function refresh(): Promise<void> {
    try {
      jobs.value = await secSourceClient.listScans()
      error.value = null
      if (selectedJobId.value && !jobs.value.some((job) => job.id === selectedJobId.value)) {
        selectedJobId.value = null
      }
      if (jobs.value.some(isActive)) startPolling()
      else stopPolling()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Unable to load scan jobs'
    }
  }

  async function initialize(): Promise<void> {
    if (initialized.value || loading.value) return
    loading.value = true
    await refresh()
    initialized.value = error.value === null
    loading.value = false
  }

  async function createScan(input: ScanCreateInput): Promise<ScanJob> {
    error.value = null
    try {
      const job = await secSourceClient.createScan(input)
      jobs.value = [job, ...jobs.value.filter((existing) => existing.id !== job.id)]
      selectedJobId.value = job.id
      startPolling()
      return job
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Unable to start scan'
      throw cause
    }
  }

  async function cancelScan(jobId: string): Promise<ScanJob> {
    error.value = null
    try {
      const updated = await secSourceClient.cancelScan(jobId)
      const index = jobs.value.findIndex((job) => job.id === jobId)
      if (index >= 0) jobs.value[index] = updated
      if (!jobs.value.some(isActive)) stopPolling()
      return updated
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Unable to cancel scan'
      throw cause
    }
  }

  async function selectProjectDirectory(): Promise<string | null> {
    error.value = null
    try {
      return await secSourceClient.selectProjectDirectory()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Unable to select a project directory'
      return null
    }
  }

  function startPolling(): void {
    if (pollTimer !== null) return
    pollTimer = setInterval(() => void refresh(), POLL_INTERVAL_MS)
  }

  function stopPolling(): void {
    if (pollTimer === null) return
    clearInterval(pollTimer)
    pollTimer = null
  }

  function dispose(): void {
    stopPolling()
  }

  return {
    jobs,
    selectedJobId,
    selectedJob,
    activeJobs,
    loading,
    error,
    initialized,
    initialize,
    refresh,
    createScan,
    cancelScan,
    selectJob,
    selectProjectDirectory,
    dispose,
  }
})
