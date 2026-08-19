<script setup lang="ts">
import {
  Activity,
  CheckCircle2,
  CircleX,
  Files,
  FilterX,
  FileJson2,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from '@lucide/vue'
import {
  NAlert,
  NButton,
  NDrawer,
  NDrawerContent,
  NInput,
  NModal,
  NPagination,
  NSelect,
  NSpin,
} from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/layout/PageHeader.vue'
import JobDetailPanel from '@/components/scans/JobDetailPanel.vue'
import NewScanDrawer from '@/components/scans/NewScanDrawer.vue'
import {
  buildReportDownload,
  serializeRawReport,
  triggerReportDownload,
} from '@/components/scans/reportDownload'
import ScanTable from '@/components/scans/ScanTable.vue'
import { vAccessibleSelect } from '@/directives/accessibleSelect'
import { filterScanJobs, type ScanDatePreset } from '@/domain/scanFilters'
import type { JobStatus, ScanCreateInput, ScanJob, ScanMode, ScanReport } from '@/domain/types'
import { useReportsStore } from '@/stores/reports'
import { useScansStore } from '@/stores/scans'

const route = useRoute()
const router = useRouter()
const reportsStore = useReportsStore()
const scansStore = useScansStore()

const search = ref('')
const projectFilter = ref('all')
const statusFilter = ref<'all' | JobStatus>('all')
const modeFilter = ref<'all' | ScanMode>('all')
const dateFilter = ref<ScanDatePreset>('all')
const page = ref(1)
const pageSize = 8
const drawerLayout = ref(false)
const detailDrawerOpen = ref(false)
const newScanOpen = ref(false)
const selectedDirectory = ref('')
const choosingDirectory = ref(false)
const creatingScan = ref(false)
const createError = ref('')
const cancellingJobId = ref<string | null>(null)
const pendingCancelJob = ref<ScanJob | null>(null)
const cancelDialogOpen = ref(false)
const selectionReady = ref(false)

const reportAction = ref<{ jobId: string; action: 'raw' | 'download' } | null>(null)
const reportError = ref<{ jobId: string; message: string } | null>(null)
const rawDialogOpen = ref(false)
const rawDialogJob = ref<ScanJob | null>(null)
const rawDialogReport = ref<ScanReport | null>(null)
const rawDialogError = ref('')
let mediaQuery: MediaQueryList | null = null

const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Queued', value: 'queued' },
  { label: 'Uploading', value: 'uploading' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
]

const modeOptions = [
  { label: 'All modes', value: 'all' },
  { label: 'Auto', value: 'auto' },
  { label: 'Deep', value: 'deep' },
  { label: 'Shallow', value: 'shallow' },
]

const dateOptions = [
  { label: 'All time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
]

const projectOptions = computed(() => {
  const projects = new Map<string, string>()
  for (const job of scansStore.jobs) {
    if (!projects.has(job.projectPath)) projects.set(job.projectPath, job.projectName)
  }
  return [
    { label: 'All projects', value: 'all' },
    ...[...projects.entries()]
      .sort((left, right) => left[1].localeCompare(right[1]))
      .map(([value, label]) => ({ label, value })),
  ]
})

const filteredJobs = computed(() =>
  filterScanJobs(scansStore.jobs, {
    query: search.value,
    projectPath: projectFilter.value,
    status: statusFilter.value,
    mode: modeFilter.value,
    date: dateFilter.value,
  }),
)

const filteredJobIds = computed(() => filteredJobs.value.map((job) => job.id).join('|'))
const pageCount = computed(() => Math.max(1, Math.ceil(filteredJobs.value.length / pageSize)))
const paginatedJobs = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredJobs.value.slice(start, start + pageSize)
})
const resultRange = computed(() => {
  if (filteredJobs.value.length === 0) return '0 jobs'
  const start = (page.value - 1) * pageSize + 1
  const end = Math.min(start + pageSize - 1, filteredJobs.value.length)
  return `${start}–${end} of ${filteredJobs.value.length} jobs`
})
const completedCount = computed(
  () => scansStore.jobs.filter((job) => job.status === 'completed').length,
)
const activeCount = computed(
  () =>
    scansStore.jobs.filter((job) => ['queued', 'uploading', 'running'].includes(job.status)).length,
)
const failedCount = computed(() => scansStore.jobs.filter((job) => job.status === 'failed').length)
const hasFilters = computed(
  () =>
    search.value.length > 0 ||
    projectFilter.value !== 'all' ||
    statusFilter.value !== 'all' ||
    modeFilter.value !== 'all' ||
    dateFilter.value !== 'all',
)
const selectedReportAction = computed(() => {
  if (reportAction.value?.jobId !== scansStore.selectedJobId) return null
  return reportAction.value.action
})
const selectedReportError = computed(() =>
  reportError.value?.jobId === scansStore.selectedJobId ? reportError.value.message : null,
)
const rawReportText = computed(() =>
  rawDialogReport.value ? serializeRawReport(rawDialogReport.value) : '',
)

watch([search, projectFilter, statusFilter, modeFilter, dateFilter], () => {
  page.value = 1
  ensureSelection(true)
})

watch(filteredJobIds, () => ensureSelection())

watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

watch(
  () => route.query.job,
  (value) => {
    if (!selectionReady.value) return
    const jobId = Array.isArray(value) ? value[0] : value
    if (!jobId || jobId === scansStore.selectedJobId) return
    const requested = scansStore.jobs.find((job) => job.id === jobId)
    if (requested) focusJob(requested, false, false)
  },
)

function replaceSelectedJobQuery(jobId: string | null) {
  const query = { ...route.query }
  if (jobId) query.job = jobId
  else delete query.job
  const current = Array.isArray(route.query.job) ? route.query.job[0] : route.query.job
  if ((current ?? null) !== jobId) void router.replace({ query })
}

function focusJob(job: ScanJob, openDrawer = true, writeRoute = true) {
  scansStore.selectJob(job.id)
  reportError.value = null
  const index = filteredJobs.value.findIndex((candidate) => candidate.id === job.id)
  if (index >= 0) page.value = Math.floor(index / pageSize) + 1
  if (writeRoute) replaceSelectedJobQuery(job.id)
  if (drawerLayout.value && openDrawer) detailDrawerOpen.value = true
}

function ensureSelection(preferFirstPage = false) {
  if (!selectionReady.value) return
  const jobs = filteredJobs.value
  if (jobs.length === 0) {
    scansStore.selectJob(null)
    replaceSelectedJobQuery(null)
    detailDrawerOpen.value = false
    return
  }

  const selectedIndex = jobs.findIndex((job) => job.id === scansStore.selectedJobId)
  if (selectedIndex < 0 || (preferFirstPage && selectedIndex >= pageSize)) {
    const firstJob = jobs[0]
    if (firstJob) focusJob(firstJob, false)
  }
}

function selectJob(job: ScanJob) {
  focusJob(job)
}

function changePage(nextPage: number) {
  page.value = nextPage
  const firstJob = filteredJobs.value[(nextPage - 1) * pageSize]
  if (firstJob) focusJob(firstJob, false)
}

function clearFilters() {
  search.value = ''
  projectFilter.value = 'all'
  statusFilter.value = 'all'
  modeFilter.value = 'all'
  dateFilter.value = 'all'
}

async function refresh() {
  await scansStore.refresh()
  ensureSelection()
}

function requestCancel(job: ScanJob) {
  pendingCancelJob.value = job
  cancelDialogOpen.value = true
}

function closeCancelDialog() {
  if (cancellingJobId.value) return
  cancelDialogOpen.value = false
  pendingCancelJob.value = null
}

async function confirmCancel() {
  const job = pendingCancelJob.value
  if (!job) return
  cancellingJobId.value = job.id
  try {
    await scansStore.cancelScan(job.id)
    cancelDialogOpen.value = false
    pendingCancelJob.value = null
  } finally {
    cancellingJobId.value = null
  }
}

function viewFindings(job: ScanJob) {
  if (!job.reportScanId) return
  void router.push({
    name: 'scan-findings',
    params: { scanId: job.reportScanId },
    query: { scope: 'scan', job: job.id },
  })
}

async function loadJobReport(job: ScanJob): Promise<ScanReport> {
  if (!job.reportScanId) throw new Error('This scan does not have an available report.')
  return reportsStore.loadReport(job.reportScanId)
}

async function showRawReport(job: ScanJob) {
  rawDialogOpen.value = true
  rawDialogJob.value = job
  rawDialogReport.value = null
  rawDialogError.value = ''
  reportError.value = null
  reportAction.value = { jobId: job.id, action: 'raw' }
  try {
    rawDialogReport.value = await loadJobReport(job)
  } catch (error) {
    rawDialogError.value = error instanceof Error ? error.message : 'Unable to load this report.'
  } finally {
    reportAction.value = null
  }
}

async function downloadReport(job: ScanJob) {
  reportError.value = null
  reportAction.value = { jobId: job.id, action: 'download' }
  try {
    const report = await loadJobReport(job)
    triggerReportDownload(buildReportDownload(report, job.format))
  } catch (error) {
    reportError.value = {
      jobId: job.id,
      message: error instanceof Error ? error.message : 'Unable to download this report.',
    }
  } finally {
    reportAction.value = null
  }
}

function closeRawDialog() {
  rawDialogOpen.value = false
}

async function chooseDirectory() {
  choosingDirectory.value = true
  createError.value = ''
  try {
    const path = await scansStore.selectProjectDirectory()
    if (path) selectedDirectory.value = path
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'Unable to choose a directory.'
  } finally {
    choosingDirectory.value = false
  }
}

async function createScan(input: ScanCreateInput) {
  creatingScan.value = true
  createError.value = ''
  try {
    const job = await scansStore.createScan(input)
    clearFilters()
    newScanOpen.value = false
    focusJob(job)
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'The scan could not be created.'
  } finally {
    creatingScan.value = false
  }
}

function updateMediaQuery(event: MediaQueryListEvent | MediaQueryList) {
  drawerLayout.value = event.matches
  if (!event.matches) detailDrawerOpen.value = false
}

onMounted(async () => {
  mediaQuery = window.matchMedia('(max-width: 1359px)')
  updateMediaQuery(mediaQuery)
  mediaQuery.addEventListener('change', updateMediaQuery)

  await scansStore.initialize()
  selectionReady.value = true
  const queryJobId = Array.isArray(route.query.job) ? route.query.job[0] : route.query.job
  const requested = queryJobId ? scansStore.jobs.find((job) => job.id === queryJobId) : undefined
  const initial = requested ?? scansStore.selectedJob ?? scansStore.jobs[0]
  if (initial) focusJob(initial, false)
  else ensureSelection()
})

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', updateMediaQuery)
})
</script>

<template>
  <div class="page-shell scans-page">
    <PageHeader
      kicker="Job management"
      title="Scans"
      description="Track scan jobs, inspect activity, and retrieve completed reports."
    >
      <template #actions>
        <NButton :loading="scansStore.loading" @click="refresh">
          <template #icon><RefreshCw :size="15" /></template>
          Refresh
        </NButton>
        <NButton type="primary" @click="newScanOpen = true">
          <template #icon><Plus :size="16" /></template>
          New scan
        </NButton>
      </template>
    </PageHeader>

    <NAlert v-if="scansStore.error" type="error" :bordered="true">
      {{ scansStore.error }}
    </NAlert>

    <section class="scan-console panel">
      <section class="summary-strip" aria-label="Scan job summary">
        <div class="summary-item">
          <span class="summary-icon"><Files :size="16" aria-hidden="true" /></span>
          <span><small>Total jobs</small><strong class="mono">{{ scansStore.jobs.length }}</strong></span>
        </div>
        <div class="summary-item summary-item--active">
          <span class="summary-icon"><Activity :size="16" aria-hidden="true" /></span>
          <span><small>Active</small><strong class="mono">{{ activeCount }}</strong></span>
        </div>
        <div class="summary-item summary-item--complete">
          <span class="summary-icon"><CheckCircle2 :size="16" aria-hidden="true" /></span>
          <span><small>Completed</small><strong class="mono">{{ completedCount }}</strong></span>
        </div>
        <div class="summary-item summary-item--failed">
          <span class="summary-icon"><CircleX :size="16" aria-hidden="true" /></span>
          <span><small>Failed</small><strong class="mono">{{ failedCount }}</strong></span>
        </div>
      </section>

      <section class="filters" aria-label="Scan filters">
        <NInput
          v-model:value="search"
          clearable
          placeholder="Search project, path, or job ID"
          :input-props="{ 'aria-label': 'Search scan jobs' }"
        >
          <template #prefix><Search :size="16" aria-hidden="true" /></template>
        </NInput>
        <NSelect
          v-accessible-select="'Filter by project'"
          v-model:value="projectFilter"
          :options="projectOptions"
          filterable
          aria-label="Filter by project"
          :input-props="{ 'aria-label': 'Filter by project' }"
        />
        <NSelect
          v-accessible-select="'Filter by job status'"
          v-model:value="statusFilter"
          :options="statusOptions"
          aria-label="Filter by job status"
        />
        <NSelect
          v-accessible-select="'Filter by scan mode'"
          v-model:value="modeFilter"
          :options="modeOptions"
          aria-label="Filter by scan mode"
        />
        <NSelect
          v-accessible-select="'Filter by scan date'"
          v-model:value="dateFilter"
          :options="dateOptions"
          aria-label="Filter by scan date"
        />
        <NButton v-if="hasFilters" class="clear-button" quaternary @click="clearFilters">
          <template #icon><FilterX :size="15" /></template>
          Clear
        </NButton>
      </section>

      <div class="scan-workspace">
        <section class="list-pane" aria-label="Scan jobs">
          <ScanTable
            :jobs="paginatedJobs"
            :selected-id="scansStore.selectedJobId"
            :loading="scansStore.loading"
            @select="selectJob"
          />
          <footer class="pagination-bar" aria-label="Scan job pagination">
            <span>{{ resultRange }}</span>
            <NPagination
              v-if="pageCount > 1"
              :page="page"
              :page-count="pageCount"
              :page-slot="5"
              @update:page="changePage"
            />
          </footer>
        </section>

        <aside v-if="!drawerLayout" class="detail-pane" aria-label="Selected job details">
          <JobDetailPanel
            v-if="scansStore.selectedJob"
            :job="scansStore.selectedJob"
            :cancelling="cancellingJobId === scansStore.selectedJob.id"
            :report-action="selectedReportAction"
            :report-error="selectedReportError"
            @cancel="requestCancel"
            @view="viewFindings"
            @raw="showRawReport"
            @download="downloadReport"
          />
          <div v-else class="detail-empty">
            <Activity :size="25" :stroke-width="1.4" aria-hidden="true" />
            <strong>Select a scan job</strong>
            <span>Job progress and activity will appear here.</span>
          </div>
        </aside>
      </div>
    </section>

    <NDrawer v-model:show="detailDrawerOpen" class="scan-detail-drawer" placement="right" :width="500">
      <NDrawerContent :native-scrollbar="false" closable title="Scan details">
        <div class="drawer-detail">
          <JobDetailPanel
            v-if="scansStore.selectedJob"
            :job="scansStore.selectedJob"
            :cancelling="cancellingJobId === scansStore.selectedJob.id"
            :report-action="selectedReportAction"
            :report-error="selectedReportError"
            @cancel="requestCancel"
            @view="viewFindings"
            @raw="showRawReport"
            @download="downloadReport"
          />
        </div>
      </NDrawerContent>
    </NDrawer>

    <NewScanDrawer
      v-model:show="newScanOpen"
      :project-path="selectedDirectory"
      :choosing="choosingDirectory"
      :submitting="creatingScan"
      :error="createError"
      @choose="chooseDirectory"
      @submit="createScan"
    />

    <NModal
      v-model:show="rawDialogOpen"
      :auto-focus="true"
      :mask-closable="!reportAction"
      :close-on-esc="!reportAction"
    >
      <section class="raw-dialog" role="dialog" aria-modal="true" aria-labelledby="raw-dialog-title">
        <header>
          <span class="raw-dialog__icon" aria-hidden="true"><FileJson2 :size="18" /></span>
          <div>
            <span class="eyebrow">Report payload</span>
            <h2 id="raw-dialog-title">Raw report</h2>
            <p>{{ rawDialogJob?.projectName }} · {{ rawDialogJob?.reportScanId }}</p>
          </div>
          <NButton quaternary aria-label="Close raw report" :disabled="Boolean(reportAction)" @click="closeRawDialog">
            <template #icon><X :size="17" /></template>
          </NButton>
        </header>
        <div class="raw-dialog__body" :aria-busy="reportAction?.action === 'raw'">
          <div v-if="reportAction?.action === 'raw'" class="raw-loading" role="status">
            <NSpin size="small" />
            <span>Loading report…</span>
          </div>
          <NAlert v-else-if="rawDialogError" type="error" :bordered="true">
            {{ rawDialogError }}
          </NAlert>
          <pre v-else><code>{{ rawReportText }}</code></pre>
        </div>
      </section>
    </NModal>

    <NModal
      v-model:show="cancelDialogOpen"
      :mask-closable="!cancellingJobId"
      :close-on-esc="!cancellingJobId"
      :auto-focus="true"
      @update:show="(show) => !show && closeCancelDialog()"
    >
      <section
        class="cancel-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
        aria-describedby="cancel-dialog-description"
      >
        <header>
          <span class="cancel-dialog__icon" aria-hidden="true">
            <TriangleAlert :size="19" />
          </span>
          <div>
            <h2 id="cancel-dialog-title">Cancel scan?</h2>
            <p id="cancel-dialog-description">
              Stop the scan for {{ pendingCancelJob?.projectName }}? Its current progress will be
              discarded.
            </p>
          </div>
        </header>
        <footer>
          <NButton :disabled="Boolean(cancellingJobId)" @click="closeCancelDialog">
            Keep running
          </NButton>
          <NButton type="error" :loading="Boolean(cancellingJobId)" @click="confirmCancel">
            Cancel scan
          </NButton>
        </footer>
      </section>
    </NModal>
  </div>
</template>

<style scoped>
.scans-page {
  display: flex;
  height: 100dvh;
  min-height: 720px;
  flex-direction: column;
}

.scans-page > :deep(.n-alert) {
  margin-bottom: 18px;
}

.scan-console {
  display: flex;
  min-height: 540px;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.summary-strip {
  display: grid;
  min-height: 78px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-bottom: 1px solid #283036;
}

.summary-item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
  padding: 13px 20px;
  border-right: 1px solid #283036;
}

.summary-item:last-child {
  border-right: 0;
}

.summary-item > span:last-child {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 2px 12px;
  flex: 1;
}

.summary-item small {
  overflow: hidden;
  color: #8b959a;
  font-size: 11px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-item strong {
  grid-row: span 2;
  color: #f0f2ed;
  font-size: 19px;
  font-weight: 650;
}

.summary-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #30383e;
  border-radius: var(--radius-compact, 2px);
  color: #90999e;
  background: #13191c;
}

.summary-item--active .summary-icon {
  border-color: #33536b;
  color: #76b7ea;
  background: #111923;
}

.summary-item--complete .summary-icon {
  border-color: #38513d;
  color: #8fc680;
  background: #121916;
}

.summary-item--failed .summary-icon {
  border-color: #653833;
  color: #f08274;
  background: #1d1212;
}

.filters {
  display: grid;
  grid-template-columns: minmax(240px, 1.4fr) minmax(150px, 0.85fr) repeat(3, minmax(124px, 0.65fr)) auto;
  gap: 9px;
  min-height: 66px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid #283036;
  background: #111619;
}

.clear-button {
  white-space: nowrap;
}

.scan-workspace {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(0, 68fr) minmax(330px, 32fr);
  overflow: hidden;
}

.list-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.list-pane > :deep(.table-shell) {
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.list-pane > :deep(.table-shell .table-scroll) {
  height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.list-pane > :deep(.table-shell .table-scroll thead) {
  position: sticky;
  z-index: 1;
  top: 0;
  background: #101518;
}

.detail-pane {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid #283036;
}

.detail-empty {
  display: grid;
  height: 100%;
  place-content: center;
  justify-items: center;
  gap: 8px;
  color: #667078;
  text-align: center;
}

.detail-empty strong {
  color: #b8beb9;
  font-size: 14px;
}

.detail-empty span {
  font-size: 12px;
}

.drawer-detail {
  height: calc(100dvh - 72px);
  min-height: 0;
  margin: -20px -24px -20px;
}

.pagination-bar {
  display: flex;
  position: relative;
  z-index: 2;
  min-height: 57px;
  flex: 0 0 57px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 14px;
  border-top: 1px solid #283036;
  background: #0f1417;
}

.pagination-bar > span {
  color: #7a848a;
  font-size: 11px;
}

.raw-dialog,
.cancel-dialog {
  overflow: hidden;
  border: 1px solid #333b40;
  border-radius: var(--radius-panel, 4px);
  color: #cbd0cb;
  background: #111518;
  box-shadow: 0 18px 54px rgb(0 0 0 / 48%);
}

.raw-dialog {
  display: flex;
  width: min(920px, calc(100vw - 56px));
  max-height: min(780px, calc(100dvh - 56px));
  flex-direction: column;
}

.raw-dialog header {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 16px 18px;
  border-bottom: 1px solid #283036;
}

.raw-dialog__icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid #41502f;
  border-radius: var(--radius-control, 3px);
  color: #b7ef45;
  background: #151b13;
}

.raw-dialog h2 {
  margin: 2px 0 0;
  color: #f2f4ef;
  font-size: 16px;
}

.raw-dialog p {
  margin: 3px 0 0;
  overflow: hidden;
  color: #778188;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.raw-dialog__body {
  min-height: 320px;
  flex: 1 1 auto;
  padding: 14px;
  overflow: auto;
  background: #0b0f11;
}

.raw-dialog__body pre {
  min-height: 100%;
  margin: 0;
  padding: 16px;
  overflow: auto;
  border: 1px solid #252d32;
  border-radius: var(--radius-compact, 2px);
  color: #bbc2be;
  background: #090c0e;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 11px;
  line-height: 1.65;
  tab-size: 2;
  white-space: pre-wrap;
  word-break: break-word;
}

.raw-loading {
  display: flex;
  min-height: 320px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #8b959a;
  font-size: 12px;
}

.cancel-dialog {
  width: min(445px, calc(100vw - 40px));
}

.cancel-dialog header {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 11px;
  padding: 20px 21px 18px;
}

.cancel-dialog__icon {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid rgb(242 109 95 / 30%);
  border-radius: var(--radius-control, 3px);
  color: #f08076;
  background: rgb(242 109 95 / 6%);
}

.cancel-dialog h2 {
  margin: 1px 0 7px;
  color: #f2f4ef;
  font-size: 16px;
}

.cancel-dialog p {
  margin: 0;
  color: #8d969b;
  font-size: 12px;
  line-height: 1.55;
}

.cancel-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 13px 21px;
  border-top: 1px solid #283036;
  background: #0e1215;
}

@media (max-width: 1359px) {
  .scans-page {
    height: auto;
  }

  .scan-console {
    flex: 0 0 auto;
  }

  .filters {
    grid-template-columns: minmax(220px, 1.3fr) repeat(2, minmax(140px, 1fr));
  }

  .clear-button {
    justify-self: start;
  }

  .scan-workspace {
    display: block;
    height: auto;
    min-height: 540px;
    overflow: visible;
  }

  .list-pane {
    display: block;
    overflow: visible;
  }

  .list-pane > :deep(.table-shell) {
    overflow: visible;
  }

  .list-pane > :deep(.table-shell .table-scroll) {
    height: auto;
    overflow-x: auto;
    overflow-y: visible;
    overscroll-behavior: auto;
    scrollbar-gutter: auto;
  }
}

@media (max-width: 940px) {
  .summary-strip {
    grid-template-columns: 1fr 1fr;
  }

  .summary-item:nth-child(2) {
    border-right: 0;
  }

  .summary-item:nth-child(-n + 2) {
    border-bottom: 1px solid #283036;
  }

  .filters {
    grid-template-columns: 1fr 1fr;
  }

  .filters > :first-child {
    grid-column: 1 / -1;
  }
}
</style>
