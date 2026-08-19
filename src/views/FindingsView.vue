<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowDown, Filter, Layers3, Search, ShieldCheck, X } from '@lucide/vue'
import { NAlert, NEmpty, NInput, NPagination, NSelect, NSkeleton } from 'naive-ui'

import SeverityBadge from '@/components/findings/SeverityBadge.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { vAccessibleSelect } from '@/directives/accessibleSelect'
import { filterFindingRecords } from '@/domain/findingFilters'
import type { AggregateTotals, FindingRecord, ScanReport, Severity } from '@/domain/types'
import { severityTotal } from '@/domain/types'
import { useReportsStore } from '@/stores/reports'

const route = useRoute()
const router = useRouter()
const reportsStore = useReportsStore()

const pageSize = 25
const isLoading = ref(true)
const loadError = ref('')
let loadSequence = 0

const severityValues: Severity[] = ['critical', 'high', 'medium', 'low', 'unknown']

function firstValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return typeof value === 'string' ? value : ''
}

const routeScanId = computed(() => firstValue(route.params.scanId))
const isScanScope = computed(() => Boolean(routeScanId.value))

function replaceListQuery(changes: Record<string, string | undefined>, resetPage = true) {
  const next = { ...route.query, ...changes }
  if (isScanScope.value) next.scope = 'scan'
  else delete next.scope
  delete next.tab
  if (!isScanScope.value) delete next.job
  if (resetPage) delete next.page
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === '') delete next[key]
  }
  void router.replace({ query: next })
}

const query = computed({
  get: () => firstValue(route.query.q),
  set: (value: string) => replaceListQuery({ q: value || undefined }),
})

const project = computed<string | null>({
  get: () => firstValue(route.query.project) || null,
  set: (value) => replaceListQuery({ project: value || undefined }),
})

const severity = computed<Severity | null>({
  get: () => {
    const value = firstValue(route.query.severity) as Severity
    return severityValues.includes(value) ? value : null
  },
  set: (value) => replaceListQuery({ severity: value || undefined }),
})

const tool = computed<string | null>({
  get: () => firstValue(route.query.tool) || null,
  set: (value) => replaceListQuery({ tool: value || undefined }),
})

const category = computed<string | null>({
  get: () => firstValue(route.query.category) || null,
  set: (value) => replaceListQuery({ category: value || undefined }),
})

const page = computed({
  get: () => {
    const parsed = Number.parseInt(firstValue(route.query.page), 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  },
  set: (value: number) => replaceListQuery({ page: value > 1 ? String(value) : undefined }, false),
})

const scopedReport = computed<ScanReport | null>(() => {
  if (!routeScanId.value) return null
  return reportsStore.getReport(routeScanId.value) ?? null
})

const currentReports = computed<ScanReport[]>(() =>
  isScanScope.value ? (scopedReport.value ? [scopedReport.value] : []) : reportsStore.latestReports,
)

const currentRecords = computed<FindingRecord[]>(() => {
  if (!isScanScope.value) return reportsStore.latestFindingRecords
  return reportsStore.allFindingRecords.filter((record) => record.scanId === routeScanId.value)
})

const currentTotals = computed<AggregateTotals>(() => {
  if (!isScanScope.value) return reportsStore.latestTotals
  const counts = scopedReport.value?.severityCounts ?? {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
  }
  return { total: severityTotal(counts), ...counts }
})

const summaryItems = computed(() => {
  const items = [
    { key: 'critical', label: 'Critical', value: currentTotals.value.critical },
    { key: 'high', label: 'High', value: currentTotals.value.high },
    { key: 'medium', label: 'Medium', value: currentTotals.value.medium },
    { key: 'low', label: 'Low', value: currentTotals.value.low },
  ]
  if (currentTotals.value.unknown > 0) {
    items.push({ key: 'unknown', label: 'Unknown', value: currentTotals.value.unknown })
  }
  items.push({ key: 'total', label: 'Total', value: currentTotals.value.total })
  return items
})

const projectOptions = computed(() => {
  const projects = new Map<string, string>()
  for (const record of currentRecords.value) projects.set(record.projectSlug, record.projectName)
  return [...projects.entries()]
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([value, label]) => ({ label, value }))
})

const severityOptions = computed(() => {
  const available = new Set(currentRecords.value.map((record) => record.finding.severity))
  return severityValues
    .filter((value) => available.has(value))
    .map((value) => ({ label: value[0]!.toUpperCase() + value.slice(1), value }))
})

const toolOptions = computed(() =>
  [...new Set(currentRecords.value.map((record) => record.finding.tool))]
    .sort()
    .map((value) => ({ label: value, value })),
)

const categoryOptions = computed(() =>
  [...new Set(currentRecords.value.map((record) => record.finding.category))]
    .sort()
    .map((value) => ({ label: value, value })),
)

const filteredRecords = computed(() =>
  filterFindingRecords(currentRecords.value, {
    query: query.value,
    project: project.value,
    severity: severity.value,
    tool: tool.value,
    category: category.value,
  }),
)

const pageCount = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / pageSize)))
const visibleRecords = computed(() => {
  const offset = (page.value - 1) * pageSize
  return filteredRecords.value.slice(offset, offset + pageSize)
})
const rangeStart = computed(() => (filteredRecords.value.length ? (page.value - 1) * pageSize + 1 : 0))
const rangeEnd = computed(() => Math.min(page.value * pageSize, filteredRecords.value.length))

const activeFilterCount = computed(
  () => [project.value, severity.value, tool.value, category.value].filter(Boolean).length,
)
const hasFilters = computed(() => Boolean(query.value.trim()) || activeFilterCount.value > 0)
const hasScopeReport = computed(() => currentReports.value.length > 0)
const isMalformedReport = computed(() =>
  currentReports.value.some((report) => report.scanId.startsWith('malformed-')),
)

const scopeLabel = computed(() => {
  if (!isScanScope.value) return 'Latest results per project'
  if (!scopedReport.value) return `Scan ${routeScanId.value.slice(0, 12)}`
  const timestamp = scopedReport.value.metadata.finishedAt || scopedReport.value.metadata.startedAt
  return `Scan: ${scopedReport.value.projectName} · ${formatDateTime(timestamp)}`
})

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatLocation(record: FindingRecord): string {
  const location = record.finding.locations[0]
  if (!location) return 'No location'
  return location.lineStart === null ? location.file : `${location.file}:${location.lineStart}`
}

function retainedListQuery(): Record<string, string> {
  const retained: Record<string, string> = {}
  for (const key of ['q', 'project', 'severity', 'tool', 'category', 'page']) {
    const value = firstValue(route.query[key])
    if (value) retained[key] = value
  }
  return retained
}

function openFinding(record: FindingRecord) {
  const detailQuery: Record<string, string> = {
    ...retainedListQuery(),
    scope: isScanScope.value ? 'scan' : 'latest',
  }
  const jobId = record.sourceJobId || firstValue(route.query.job)
  if (jobId) detailQuery.job = jobId

  void router.push({
    name: 'finding-detail',
    params: { scanId: record.scanId, findingId: record.finding.id },
    query: detailQuery,
  })
}

function clearFilters() {
  replaceListQuery({
    q: undefined,
    project: undefined,
    severity: undefined,
    tool: undefined,
    category: undefined,
    page: undefined,
  })
}

function clearScanScope() {
  const next = retainedListQuery()
  delete next.page
  void router.push({ name: 'findings', query: next })
}

async function loadScope(scanId: string) {
  const sequence = ++loadSequence
  isLoading.value = true
  loadError.value = ''
  try {
    if (scanId) await reportsStore.loadReport(scanId)
    else await reportsStore.initialize()
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : 'Unable to load scan findings.'
  } finally {
    if (sequence === loadSequence) isLoading.value = false
  }
}

watch(routeScanId, (scanId) => void loadScope(scanId), { immediate: true })

watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})
</script>

<template>
  <div class="page-shell findings-page">
    <PageHeader
      kicker="Security analysis"
      title="Findings"
      :description="
        isScanScope
          ? 'Review issues reported by this completed scan.'
          : 'Prioritize issues across the latest completed scan of each project.'
      "
    />

    <NAlert v-if="loadError || reportsStore.error" type="error" :bordered="true" class="load-alert">
      <template #icon><AlertTriangle :size="18" /></template>
      {{ loadError || reportsStore.error }}
    </NAlert>

    <NAlert
      v-if="!isScanScope && reportsStore.reportWarningCount"
      type="warning"
      :bordered="true"
      class="load-alert"
    >
      <template #icon><AlertTriangle :size="18" /></template>
      {{ reportsStore.reportWarningCount }} report{{ reportsStore.reportWarningCount === 1 ? '' : 's' }}
      could not be loaded. Available results are still shown.
    </NAlert>

    <NAlert v-if="isMalformedReport" type="warning" :bordered="true" class="load-alert">
      This report is malformed or missing metadata. Safe defaults are shown where possible.
    </NAlert>

    <div v-if="isLoading" class="loading-shell panel" aria-label="Loading findings">
      <NSkeleton text :repeat="3" />
      <NSkeleton height="520px" />
    </div>

    <template v-else-if="hasScopeReport">
      <section class="severity-summary panel" aria-label="Severity summary">
        <article
          v-for="item in summaryItems"
          :key="item.key"
          class="severity-summary__item"
          :class="`severity-summary__item--${item.key}`"
        >
          <span class="severity-summary__label">
            <i v-if="item.key !== 'total'" aria-hidden="true" />
            {{ item.label }}
          </span>
          <strong class="mono">{{ item.value }}</strong>
        </article>
      </section>

      <section class="filter-panel panel" aria-label="Finding filters">
        <div class="filter-toolbar">
          <NInput
            v-model:value="query"
            clearable
            placeholder="Search finding, package, project, or file"
            :input-props="{ 'aria-label': 'Search findings' }"
          >
            <template #prefix><Search :size="15" /></template>
          </NInput>
          <NSelect
            v-accessible-select="'Filter project'"
            v-model:value="project"
            clearable
            placeholder="Project"
            :options="projectOptions"
            aria-label="Filter project"
          />
          <NSelect
            v-accessible-select="'Filter severity'"
            v-model:value="severity"
            clearable
            placeholder="Severity"
            :options="severityOptions"
            aria-label="Filter severity"
          />
          <NSelect
            v-accessible-select="'Filter tool'"
            v-model:value="tool"
            clearable
            placeholder="Tool"
            :options="toolOptions"
            aria-label="Filter tool"
          />
          <NSelect
            v-accessible-select="'Filter category'"
            v-model:value="category"
            clearable
            placeholder="Category"
            :options="categoryOptions"
            aria-label="Filter category"
          />
        </div>

        <div class="filter-context">
          <button
            v-if="isScanScope"
            type="button"
            class="scope-chip scope-chip--dismissible"
            :aria-label="`${scopeLabel}. Show latest results per project`"
            @click="clearScanScope"
          >
            <Layers3 :size="13" />
            <span>{{ scopeLabel }}</span>
            <X :size="13" aria-hidden="true" />
          </button>
          <span v-else class="scope-chip"><Layers3 :size="13" />{{ scopeLabel }}</span>

          <div class="filter-context__result">
            <span><Filter :size="12" />{{ filteredRecords.length }} of {{ currentRecords.length }} findings</span>
            <button v-if="hasFilters" type="button" @click="clearFilters">Clear filters</button>
          </div>
        </div>
      </section>

      <section class="findings-list panel" aria-label="Findings list">
        <header class="list-header">
          <strong>{{ filteredRecords.length }} findings</strong>
          <span class="mono">{{ rangeStart }}–{{ rangeEnd }} of {{ filteredRecords.length }}</span>
        </header>

        <div v-if="visibleRecords.length" class="finding-table-wrap">
          <table class="finding-table">
            <colgroup>
              <col class="col-severity" />
              <col class="col-finding" />
              <col class="col-project" />
              <col class="col-source" />
              <col class="col-seen" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Severity</th>
                <th scope="col">Finding</th>
                <th scope="col">Project</th>
                <th scope="col">Source / location</th>
                <th scope="col" class="last-seen-heading">Last seen <ArrowDown :size="11" /></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in visibleRecords" :key="record.key" @click="openFinding(record)">
                <td><SeverityBadge :severity="record.finding.severity" compact /></td>
                <td>
                  <button
                    type="button"
                    class="finding-select"
                    :aria-label="`Open ${record.finding.ruleId} in ${record.projectName}`"
                    @click.stop="openFinding(record)"
                  >
                    <strong class="finding-rule mono">{{ record.finding.ruleId }}</strong>
                    <span class="finding-message">{{ record.finding.message }}</span>
                  </button>
                </td>
                <td><span class="cell-truncate">{{ record.projectName }}</span></td>
                <td>
                  <span class="source-tool">{{ record.finding.tool }}</span>
                  <span class="source-location mono">{{ formatLocation(record) }}</span>
                </td>
                <td class="last-seen">{{ formatDateTime(record.scanFinishedAt || record.scanStartedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="list-empty">
          <NEmpty description="No findings match these filters." />
        </div>

        <footer class="list-pagination">
          <span class="mono">Page {{ page }} of {{ pageCount }}</span>
          <NPagination v-model:page="page" :page-count="pageCount" :page-slot="5" size="small" />
        </footer>
      </section>
    </template>

    <div v-else class="empty-report panel">
      <ShieldCheck :size="30" />
      <NEmpty
        :description="isScanScope ? 'This scan report is unavailable.' : 'No valid scan reports are available.'"
      />
      <button v-if="isScanScope" type="button" @click="clearScanScope">Return to latest results</button>
    </div>
  </div>
</template>

<style scoped>
.findings-page {
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
}

.load-alert { flex: 0 0 auto; margin-bottom: 14px; }
.loading-shell { display: grid; gap: 22px; padding: 24px; }

.severity-summary {
  display: grid;
  flex: 0 0 auto;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  margin-bottom: 14px;
}

.severity-summary__item {
  display: flex;
  min-width: 0;
  min-height: 74px;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  padding: 13px 22px;
}

.severity-summary__item + .severity-summary__item { border-left: 1px solid #283036; }

.severity-summary__label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8e979c;
  font-size: 11px;
}

.severity-summary__label i {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-compact);
  background: #879198;
}

.severity-summary__item strong { color: #eff2ed; font-size: 21px; line-height: 1; }
.severity-summary__item--critical i { background: #ff5d68; }
.severity-summary__item--high i { background: #ff8a58; }
.severity-summary__item--medium i { background: #e7b84b; }
.severity-summary__item--low i { background: #66b5f6; }

.filter-panel { flex: 0 0 auto; margin-bottom: 14px; padding: 14px 16px 11px; }

.filter-toolbar {
  display: grid;
  grid-template-columns: minmax(250px, 1.8fr) repeat(4, minmax(112px, 1fr));
  gap: 9px;
}

.filter-context {
  display: flex;
  min-height: 31px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  padding-top: 10px;
}

.scope-chip {
  display: inline-flex;
  overflow: hidden;
  min-width: 0;
  align-items: center;
  gap: 7px;
  padding: 4px 8px;
  border: 1px solid #343c42;
  border-radius: var(--radius-compact);
  color: #b4bcb7;
  background: #151a1d;
  font-size: 10.5px;
  font-weight: 620;
  line-height: 1.4;
}

.scope-chip span,
.finding-rule,
.finding-message,
.cell-truncate,
.source-location {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-chip--dismissible { cursor: pointer; }
.scope-chip--dismissible:hover { border-color: #59644f; color: #dce3d9; background: #192019; }

.filter-context__result {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 14px;
  color: #778288;
  font-size: 10.5px;
}

.filter-context__result span { display: flex; align-items: center; gap: 5px; }

.filter-context__result button,
.empty-report button {
  padding: 0;
  border: 0;
  color: #b7ef45;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 640;
}

.findings-list {
  display: flex;
  overflow: hidden;
  min-height: 560px;
  flex: 1;
  flex-direction: column;
}

.list-header {
  display: flex;
  min-height: 45px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid #283036;
  background: #111518;
}

.list-header strong { color: #dce1dc; font-size: 12px; }
.list-header span { color: #788288; font-size: 10px; }

.finding-table-wrap {
  overflow: auto;
  min-height: 0;
  flex: 1;
  scrollbar-gutter: stable;
}

.finding-table {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  table-layout: fixed;
}

.finding-table .col-severity { width: 112px; }
.finding-table .col-finding { width: auto; }
.finding-table .col-project { width: 190px; }
.finding-table .col-source { width: 245px; }
.finding-table .col-seen { width: 145px; }

.finding-table th {
  position: sticky;
  z-index: 2;
  top: 0;
  height: 39px;
  padding: 0 14px;
  border-bottom: 1px solid #283036;
  color: #788288;
  background: #0f1315;
  font-size: 10px;
  font-weight: 620;
  text-align: left;
}

.last-seen-heading svg { display: inline; margin-left: 3px; color: #b7ef45; vertical-align: -2px; }

.finding-table tbody tr {
  height: 63px;
  border-bottom: 1px solid #242b30;
  cursor: pointer;
  transition: background 120ms ease;
}

.finding-table tbody tr:hover { background: #13191c; }

.finding-table td {
  overflow: hidden;
  min-width: 0;
  padding: 9px 14px;
  color: #aeb6b1;
  font-size: 11px;
  vertical-align: middle;
}

.finding-select {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.finding-rule { display: block; margin-bottom: 4px; color: #e4e8e2; font-size: 11px; }
.finding-message { display: block; color: #788287; font-size: 10px; }
.cell-truncate,
.source-location { display: block; }

.source-tool {
  display: inline-flex;
  max-width: 100%;
  margin-bottom: 4px;
  padding: 1px 5px;
  border: 1px solid #3b4449;
  border-radius: var(--radius-compact);
  color: #aab3b7;
  font-size: 9px;
  font-weight: 620;
}

.source-location { color: #7a858a; font-size: 9.5px; }
.last-seen { color: #899398 !important; font-size: 10px !important; line-height: 1.45; }

.list-empty { display: grid; min-height: 300px; flex: 1; place-items: center; padding: 24px; }

.list-pagination {
  display: flex;
  min-height: 53px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 14px;
  border-top: 1px solid #283036;
  background: #111518;
}

.list-pagination > span { color: #747f84; font-size: 10px; }

.empty-report {
  display: flex;
  min-height: 500px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #667177;
}

@media (max-width: 1080px) {
  .filter-toolbar { grid-template-columns: minmax(240px, 1.6fr) repeat(2, minmax(130px, 1fr)); }
  .severity-summary__item { padding-inline: 15px; }
}

@media (max-width: 820px) {
  .filter-toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .filter-toolbar > :first-child { grid-column: 1 / -1; }
  .filter-context { align-items: flex-start; flex-direction: column; gap: 8px; }
}
</style>
