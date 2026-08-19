<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, FileSearch, Layers3 } from '@lucide/vue'
import { NAlert, NEmpty, NSkeleton } from 'naive-ui'

import FindingDetailPanel from '@/components/findings/FindingDetailPanel.vue'
import type { FindingRecord } from '@/domain/types'
import { useReportsStore } from '@/stores/reports'
import { useScansStore } from '@/stores/scans'

type DetailTab = 'overview' | 'evidence' | 'raw'

const route = useRoute()
const router = useRouter()
const reportsStore = useReportsStore()
const scansStore = useScansStore()

const isLoading = ref(true)
const loadError = ref('')
let loadSequence = 0

function firstValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return typeof value === 'string' ? value : ''
}

const scanId = computed(() => firstValue(route.params.scanId))
const findingId = computed(() => firstValue(route.params.findingId))
const scope = computed<'latest' | 'scan'>(() =>
  firstValue(route.query.scope) === 'latest' ? 'latest' : 'scan',
)

const record = computed<FindingRecord | null>(() => {
  if (!scanId.value || !findingId.value) return null
  return reportsStore.getFindingRecord(scanId.value, findingId.value) ?? null
})

const activeTab = computed<DetailTab>(() => {
  const value = firstValue(route.query.tab)
  return value === 'evidence' || value === 'raw' ? value : 'overview'
})

const sourceJobId = computed(() => {
  const candidates = [
    firstValue(route.query.job),
    record.value?.sourceJobId ?? '',
    reportsStore.getSourceJobId(scanId.value) ?? '',
  ]
  const matched = candidates.find((candidate) =>
    scansStore.jobs.some(
      (job) => job.id === candidate && job.reportScanId === scanId.value,
    ),
  )
  return matched || scansStore.jobs.find((job) => job.reportScanId === scanId.value)?.id || null
})

function retainedListQuery(): Record<string, string> {
  const retained: Record<string, string> = {}
  for (const key of ['q', 'project', 'severity', 'tool', 'category', 'page']) {
    const value = firstValue(route.query[key])
    if (value) retained[key] = value
  }
  return retained
}

const backTarget = computed(() => {
  const query: Record<string, string> = retainedListQuery()
  if (scope.value === 'latest') return { name: 'findings', query }
  query.scope = 'scan'
  if (sourceJobId.value) query.job = sourceJobId.value
  return { name: 'scan-findings', params: { scanId: scanId.value }, query }
})

const contextLabel = computed(() => {
  if (scope.value === 'latest') return 'Latest results per project'
  if (!record.value) return `Scan ${scanId.value.slice(0, 12)}`
  return `Scan: ${record.value.projectName}`
})

function setActiveTab(tab: DetailTab) {
  const query = { ...route.query }
  if (tab === 'overview') delete query.tab
  else query.tab = tab
  void router.replace({ query })
}

function openScan(jobId: string) {
  void router.push({ name: 'scans', query: { job: jobId } })
}

async function loadFindingReport(requestedScanId: string) {
  const sequence = ++loadSequence
  isLoading.value = true
  loadError.value = ''
  const jobsPromise = scansStore.initialized ? Promise.resolve() : scansStore.initialize()
  try {
    await reportsStore.loadReport(requestedScanId)
    await jobsPromise
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : 'Unable to load this finding.'
  } finally {
    if (sequence === loadSequence) isLoading.value = false
  }
}

watch(scanId, (value) => void loadFindingReport(value), { immediate: true })
</script>

<template>
  <div class="page-shell finding-detail-page">
    <nav class="detail-navigation" aria-label="Finding navigation">
      <RouterLink :to="backTarget" class="back-link">
        <ArrowLeft :size="15" aria-hidden="true" />
        Back to findings
      </RouterLink>
      <span aria-hidden="true">/</span>
      <span class="detail-scope"><Layers3 :size="13" aria-hidden="true" />{{ contextLabel }}</span>
    </nav>

    <div v-if="isLoading" class="detail-loading panel" aria-label="Loading finding details">
      <NSkeleton text :repeat="2" />
      <NSkeleton height="560px" />
    </div>

    <section v-else-if="loadError" class="detail-state panel" aria-labelledby="report-error-title">
      <AlertTriangle :size="30" aria-hidden="true" />
      <h1 id="report-error-title">Report unavailable</h1>
      <NAlert type="error" :bordered="true">{{ loadError }}</NAlert>
      <RouterLink :to="backTarget">Return to findings</RouterLink>
    </section>

    <section v-else-if="!record" class="detail-state panel" aria-labelledby="finding-error-title">
      <FileSearch :size="32" aria-hidden="true" />
      <h1 id="finding-error-title">Finding not found</h1>
      <NEmpty description="This report does not contain the requested finding." />
      <RouterLink :to="backTarget">Return to findings</RouterLink>
    </section>

    <main v-else class="detail-panel panel">
      <FindingDetailPanel
        :finding="record.finding"
        :project-name="record.projectName"
        :scan-finished-at="record.scanFinishedAt || record.scanStartedAt"
        :source-job-id="sourceJobId"
        :active-tab="activeTab"
        heading-tag="h1"
        @update:active-tab="setActiveTab"
        @open-scan="openScan"
      />
    </main>
  </div>
</template>

<style scoped>
.finding-detail-page {
  min-height: 100dvh;
}

.detail-navigation {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 17px;
  color: #68737a;
  font-size: 11px;
}

.back-link,
.detail-scope {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.back-link {
  color: #b9c1bc;
  font-weight: 640;
  text-decoration: none;
}

.back-link:hover { color: #b7ef45; }
.detail-scope { overflow: hidden; color: #7e898e; text-overflow: ellipsis; white-space: nowrap; }

.detail-loading {
  display: grid;
  gap: 22px;
  padding: 26px;
}

.detail-panel {
  overflow: hidden;
  min-height: 650px;
}

.detail-panel :deep(.finding-detail) {
  height: auto;
  min-height: 648px;
}

.detail-panel :deep(.finding-detail__tabs .n-tabs-pane-wrapper) {
  overflow: visible;
}

.detail-panel :deep(.finding-detail__tabs .n-tab-pane) {
  overflow: visible;
  height: auto;
}

.detail-state {
  display: flex;
  min-height: 540px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 36px;
  color: #68737a;
  text-align: center;
}

.detail-state h1 {
  margin: 0;
  color: #e8ebe6;
  font-size: 24px;
}

.detail-state :deep(.n-alert) { width: min(620px, 100%); text-align: left; }
.detail-state a { color: #b7ef45; font-size: 12px; font-weight: 650; }

@media (max-width: 940px) {
  .detail-panel { min-height: 600px; }
  .detail-panel :deep(.finding-detail) { min-height: 598px; }
}
</style>
