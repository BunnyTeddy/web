<script setup lang="ts">
import {
  Activity,
  CheckCircle2,
  FilterX,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
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
} from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/layout/PageHeader.vue'
import JobDetailPanel from '@/components/scans/JobDetailPanel.vue'
import NewScanDrawer from '@/components/scans/NewScanDrawer.vue'
import ScanTable from '@/components/scans/ScanTable.vue'
import type { JobStatus, ScanCreateInput, ScanJob, ScanMode } from '@/domain/types'
import { useScansStore } from '@/stores/scans'

const route = useRoute()
const router = useRouter()
const scansStore = useScansStore()

const search = ref('')
const statusFilter = ref<'all' | JobStatus>('all')
const modeFilter = ref<'all' | ScanMode>('all')
const page = ref(1)
const pageSize = 8
const isTablet = ref(false)
const detailDrawerOpen = ref(false)
const newScanOpen = ref(false)
const selectedDirectory = ref('')
const choosingDirectory = ref(false)
const creatingScan = ref(false)
const createError = ref('')
const cancellingJobId = ref<string | null>(null)
const pendingCancelJob = ref<ScanJob | null>(null)
const cancelDialogOpen = ref(false)
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

const filteredJobs = computed(() => {
  const query = search.value.trim().toLowerCase()
  return scansStore.jobs.filter((job) => {
    const matchesSearch =
      !query ||
      job.projectName.toLowerCase().includes(query) ||
      job.projectPath.toLowerCase().includes(query) ||
      job.id.toLowerCase().includes(query)
    const matchesStatus = statusFilter.value === 'all' || job.status === statusFilter.value
    const matchesMode = modeFilter.value === 'all' || job.mode === modeFilter.value
    return matchesSearch && matchesStatus && matchesMode
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredJobs.value.length / pageSize)))
const paginatedJobs = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredJobs.value.slice(start, start + pageSize)
})
const completedCount = computed(
  () => scansStore.jobs.filter((job) => job.status === 'completed').length,
)
const activeCount = computed(
  () =>
    scansStore.jobs.filter((job) => ['queued', 'uploading', 'running'].includes(job.status)).length,
)
const totalFindings = computed(() =>
  scansStore.jobs.reduce((total, job) => total + job.findingCount, 0),
)
const hasFilters = computed(
  () => search.value.length > 0 || statusFilter.value !== 'all' || modeFilter.value !== 'all',
)

watch([search, statusFilter, modeFilter], () => {
  page.value = 1
})

watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

function selectJob(job: ScanJob) {
  scansStore.selectJob(job.id)
  void router.replace({ query: { ...route.query, job: job.id } })
  if (isTablet.value) detailDrawerOpen.value = true
}

function clearFilters() {
  search.value = ''
  statusFilter.value = 'all'
  modeFilter.value = 'all'
}

async function refresh() {
  await scansStore.refresh()
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
  if (job.reportScanId) void router.push(`/findings/${job.reportScanId}`)
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
    newScanOpen.value = false
    selectJob(job)
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'The scan could not be created.'
  } finally {
    creatingScan.value = false
  }
}

function updateMediaQuery(event: MediaQueryListEvent | MediaQueryList) {
  isTablet.value = event.matches
  if (!event.matches) detailDrawerOpen.value = false
}

onMounted(async () => {
  mediaQuery = window.matchMedia('(max-width: 1279px)')
  updateMediaQuery(mediaQuery)
  mediaQuery.addEventListener('change', updateMediaQuery)

  await scansStore.initialize()
  const queryJobId = Array.isArray(route.query.job) ? route.query.job[0] : route.query.job
  const requested = queryJobId
    ? scansStore.jobs.find((job) => job.id === queryJobId)
    : undefined
  const initial = requested ?? scansStore.selectedJob ?? scansStore.jobs[0]
  if (initial) scansStore.selectJob(initial.id)
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
      description="Track every local scan from queue to report."
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
        <div>
          <Activity :size="16" aria-hidden="true" />
          <span>Active</span>
          <strong class="mono">{{ activeCount }}</strong>
        </div>
        <div>
          <CheckCircle2 :size="16" aria-hidden="true" />
          <span>Completed</span>
          <strong class="mono">{{ completedCount }}</strong>
        </div>
        <div>
          <span class="finding-mark" aria-hidden="true">!</span>
          <span>Findings</span>
          <strong class="mono">{{ totalFindings }}</strong>
        </div>
        <p>{{ filteredJobs.length }} of {{ scansStore.jobs.length }} jobs shown</p>
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
          v-model:value="statusFilter"
          :options="statusOptions"
          aria-label="Filter by job status"
        />
        <NSelect v-model:value="modeFilter" :options="modeOptions" aria-label="Filter by scan mode" />
        <NButton v-if="hasFilters" quaternary @click="clearFilters">
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
          <footer v-if="filteredJobs.length > pageSize" class="pagination-bar">
            <span>Page {{ page }} of {{ pageCount }}</span>
            <NPagination v-model:page="page" :page-count="pageCount" :page-slot="5" />
          </footer>
        </section>

        <aside v-if="!isTablet" class="detail-pane" aria-label="Selected job details">
          <JobDetailPanel
            v-if="scansStore.selectedJob"
            :job="scansStore.selectedJob"
            :cancelling="cancellingJobId === scansStore.selectedJob.id"
            @cancel="requestCancel"
            @view="viewFindings"
          />
          <div v-else class="detail-empty">
            <Activity :size="25" :stroke-width="1.4" aria-hidden="true" />
            <strong>Select a scan job</strong>
            <span>Job progress and activity will appear here.</span>
          </div>
        </aside>
      </div>
    </section>

    <NDrawer v-model:show="detailDrawerOpen" placement="right" :width="430">
      <NDrawerContent :native-scrollbar="false" closable title="Scan details">
        <JobDetailPanel
          v-if="scansStore.selectedJob"
          :job="scansStore.selectedJob"
          :cancelling="cancellingJobId === scansStore.selectedJob.id"
          @cancel="requestCancel"
          @view="viewFindings"
        />
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
  display: flex;
  min-height: 70px;
  align-items: stretch;
  border-bottom: 1px solid #283036;
}

.summary-strip > div {
  display: flex;
  min-width: 170px;
  align-items: center;
  gap: 9px;
  padding: 0 20px;
  border-right: 1px solid #283036;
  color: #90999e;
  font-size: 12px;
  font-weight: 600;
}

.summary-strip svg,
.finding-mark {
  color: #879098;
}

.finding-mark {
  display: grid;
  width: 16px;
  height: 16px;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 10px;
}

.summary-strip strong {
  margin-left: auto;
  color: #e5e8e3;
  font-size: 16px;
}

.summary-strip p {
  margin: auto 20px auto auto;
  color: #7a848a;
  font-size: 11px;
}

.filters {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 165px 150px auto;
  gap: 10px;
  min-height: 66px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid #283036;
  background: #111619;
}

.scan-workspace {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) 370px;
  overflow: hidden;
}

.list-pane {
  min-width: 0;
  min-height: 0;
  overflow: auto;
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

.cancel-dialog {
  width: min(445px, calc(100vw - 40px));
  overflow: hidden;
  border: 1px solid #333b40;
  border-radius: 7px;
  color: #cbd0cb;
  background: #111518;
  box-shadow: 0 18px 54px rgb(0 0 0 / 48%);
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
  border-radius: 5px;
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

.pagination-bar {
  display: flex;
  min-height: 57px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 14px;
  border-top: 1px solid #283036;
}

.pagination-bar > span {
  color: #697279;
  font-size: 11px;
}

@media (max-width: 1279px) {
  .scans-page {
    height: auto;
  }

  .scan-console {
    flex: 0 0 auto;
  }

  .scan-workspace {
    display: block;
    height: auto;
    min-height: 540px;
    max-height: none;
    overflow: visible;
  }

  .list-pane {
    border-right: 0;
  }
}

@media (max-width: 940px) {
  .filters {
    grid-template-columns: minmax(230px, 1fr) 150px 140px auto;
  }

  .summary-strip > div {
    min-width: 128px;
    padding: 0 12px;
  }
}
</style>
