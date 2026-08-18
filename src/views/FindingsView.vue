<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  AlertTriangle,
  ChevronRight,
  FileSearch,
  Filter,
  Search,
  ShieldCheck,
} from '@lucide/vue'
import {
  NAlert,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NInput,
  NPagination,
  NSelect,
  NSkeleton,
} from 'naive-ui'

import type { Finding, ScanReport } from '@/domain/types'
import { filterFindings } from '@/domain/findingFilters'
import FindingDetailPanel from '@/components/findings/FindingDetailPanel.vue'
import SeverityBadge from '@/components/findings/SeverityBadge.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { useReportsStore } from '@/stores/reports'

const route = useRoute()
const router = useRouter()
const reportsStore = useReportsStore()
const { reports } = storeToRefs(reportsStore)

const query = ref('')
const severity = ref<string | null>(null)
const tool = ref<string | null>(null)
const category = ref<string | null>(null)
const page = ref(1)
const pageSize = 10
const isInitializing = ref(true)
const initializeError = ref('')
const isTablet = ref(false)
const detailDrawerOpen = ref(false)
let mediaQuery: MediaQueryList | undefined

const routeScanId = computed(() => {
  const value = route.params.scanId
  return Array.isArray(value) ? value[0] || '' : value || ''
})

const routeFindingId = computed(() => {
  const value = route.params.findingId
  return Array.isArray(value) ? value[0] || '' : value || ''
})

const selectedReport = computed<ScanReport | null>(() => {
  const explicit = routeScanId.value
  if (explicit) return reportsStore.getReport(explicit) ?? null
  return reports.value[0] ?? null
})

const scanOptions = computed(() =>
  reports.value.map((report) => ({
    label: report.projectName,
    value: report.scanId,
  })),
)

const currentFindings = computed(() => selectedReport.value?.findings ?? [])

const severityOptions = computed(() => {
  const order = ['critical', 'high', 'medium', 'low', 'info', 'unknown']
  const values = new Set(currentFindings.value.map((finding) => finding.severity))
  return order
    .filter((value) => values.has(value as Finding['severity']))
    .map((value) => ({ label: value[0]!.toUpperCase() + value.slice(1), value }))
})

const toolOptions = computed(() =>
  [...new Set(currentFindings.value.map((finding) => finding.tool))]
    .sort()
    .map((value) => ({ label: value, value })),
)

const categoryOptions = computed(() =>
  [...new Set(currentFindings.value.map((finding) => finding.category))]
    .sort()
    .map((value) => ({ label: value, value })),
)

const filteredFindings = computed(() => {
  return filterFindings(currentFindings.value, {
    query: query.value,
    severity: severity.value as Finding['severity'] | null,
    tool: tool.value,
    category: category.value,
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredFindings.value.length / pageSize)))

const visibleFindings = computed(() => {
  const offset = (page.value - 1) * pageSize
  return filteredFindings.value.slice(offset, offset + pageSize)
})

const selectedFinding = computed<Finding | null>(() => {
  const requestedId = routeFindingId.value
  if (requestedId) {
    const requested = visibleFindings.value.find((finding) => finding.id === requestedId)
    if (requested) return requested
  }

  return visibleFindings.value[0] ?? filteredFindings.value[0] ?? null
})

const activeFilterCount = computed(
  () => [severity.value, tool.value, category.value].filter(Boolean).length,
)

const selectedCounts = computed(() => selectedReport.value?.severityCounts)
const isMalformedReport = computed(() => selectedReport.value?.scanId.startsWith('malformed-') ?? false)

function navigateToReport(scanId: string) {
  page.value = 1
  void router.replace({ name: 'findings', params: { scanId } })
}

function selectFinding(finding: Finding) {
  if (!selectedReport.value) return
  void router.replace({
    name: 'findings',
    params: { scanId: selectedReport.value.scanId, findingId: finding.id },
  })
  if (isTablet.value) detailDrawerOpen.value = true
}

function clearFilters() {
  query.value = ''
  severity.value = null
  tool.value = null
  category.value = null
}

function updateMediaQuery(event?: MediaQueryListEvent) {
  isTablet.value = event?.matches ?? mediaQuery?.matches ?? false
  if (!isTablet.value) detailDrawerOpen.value = false
}

async function loadRequestedReport(scanId: string) {
  if (!scanId || reportsStore.getReport(scanId)) return
  initializeError.value = ''
  try {
    await reportsStore.loadReport(scanId)
  } catch (error) {
    initializeError.value =
      error instanceof Error ? error.message : 'Unable to load the requested scan report.'
  }
}

watch([query, severity, tool, category], () => {
  page.value = 1
})

watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

watch(
  [routeFindingId, filteredFindings],
  ([findingId, findings]) => {
    if (!findingId) return
    const index = findings.findIndex((finding) => finding.id === findingId)
    if (index >= 0) page.value = Math.floor(index / pageSize) + 1
  },
  { flush: 'post' },
)

watch(page, () => {
  if (!selectedReport.value || !routeFindingId.value) return
  if (visibleFindings.value.some((finding) => finding.id === routeFindingId.value)) return
  const firstVisible = visibleFindings.value[0]
  if (!firstVisible) return
  void router.replace({
    name: 'findings',
    params: { scanId: selectedReport.value.scanId, findingId: firstVisible.id },
  })
})

watch(routeScanId, (scanId) => {
  void loadRequestedReport(scanId)
})

onMounted(async () => {
  mediaQuery = window.matchMedia('(max-width: 1199px)')
  updateMediaQuery()
  mediaQuery.addEventListener('change', updateMediaQuery)

  try {
    await reportsStore.initialize()
    if (routeScanId.value) {
      await loadRequestedReport(routeScanId.value)
    } else if (reports.value[0]) {
      await router.replace({
        name: 'findings',
        params: { scanId: reports.value[0].scanId },
      })
    }
  } catch (error) {
    initializeError.value = error instanceof Error ? error.message : 'Unable to load scan reports.'
  } finally {
    isInitializing.value = false
  }
})

onBeforeUnmount(() => mediaQuery?.removeEventListener('change', updateMediaQuery))
</script>

<template>
  <div class="page-shell findings-page">
    <PageHeader
      kicker="Security analysis"
      title="Findings"
      description="Review security issues, trace supporting evidence, and plan remediation."
    >
      <template #actions>
        <div class="project-picker">
          <label for="report-selector">Scan report</label>
          <NSelect
            :value="selectedReport?.scanId || null"
            :options="scanOptions"
            :input-props="{ id: 'report-selector', 'aria-label': 'Scan report' }"
            :consistent-menu-width="false"
            placeholder="Select a report"
            @update:value="navigateToReport"
          />
        </div>
      </template>
    </PageHeader>

    <NAlert v-if="initializeError || reportsStore.error" type="error" :bordered="true" class="load-alert">
      <template #icon><AlertTriangle :size="18" /></template>
      {{ initializeError || reportsStore.error }}
    </NAlert>

    <NAlert v-if="isMalformedReport" type="warning" :bordered="true" class="load-alert">
      This report is malformed or missing metadata. Safe defaults are shown where possible.
    </NAlert>

    <template v-if="isInitializing">
      <div class="loading-shell panel">
        <NSkeleton text :repeat="3" />
        <NSkeleton height="420px" />
      </div>
    </template>

    <div v-else-if="selectedReport" class="findings-workspace panel">
      <section class="findings-master" aria-label="Findings list">
        <div class="report-summary">
          <div class="report-summary__identity">
            <span class="report-summary__name">{{ selectedReport.projectName }}</span>
            <span class="mono">{{ selectedReport.scanId.slice(0, 12) }}</span>
          </div>
          <strong class="report-summary__total">{{ currentFindings.length }} findings</strong>
          <div class="report-counts" aria-label="Severity totals">
            <span class="report-count report-count--critical"><b>{{ selectedCounts?.critical ?? 0 }}</b> Critical</span>
            <span class="report-count report-count--high"><b>{{ selectedCounts?.high ?? 0 }}</b> High</span>
            <span class="report-count report-count--medium"><b>{{ selectedCounts?.medium ?? 0 }}</b> Medium</span>
            <span class="report-count report-count--low"><b>{{ selectedCounts?.low ?? 0 }}</b> Low</span>
          </div>
        </div>

        <div class="filters">
          <NInput
            v-model:value="query"
            clearable
            placeholder="Search rule, package, or message"
            :input-props="{ 'aria-label': 'Search findings' }"
          >
            <template #prefix><Search :size="15" /></template>
          </NInput>
          <div class="filter-row">
            <NSelect
              v-model:value="severity"
              clearable
              placeholder="Severity"
              :options="severityOptions"
              :input-props="{ 'aria-label': 'Filter severity' }"
            />
            <NSelect
              v-model:value="tool"
              clearable
              placeholder="Tool"
              :options="toolOptions"
              :input-props="{ 'aria-label': 'Filter tool' }"
            />
            <NSelect
              v-model:value="category"
              clearable
              placeholder="Category"
              :options="categoryOptions"
              :input-props="{ 'aria-label': 'Filter category' }"
            />
          </div>
          <div class="filter-summary">
            <span><Filter :size="12" /> {{ filteredFindings.length }} of {{ currentFindings.length }} findings</span>
            <button v-if="query || activeFilterCount" type="button" @click="clearFilters">Clear filters</button>
          </div>
        </div>

        <div v-if="visibleFindings.length" class="finding-list">
          <button
            v-for="finding in visibleFindings"
            :key="finding.id"
            type="button"
            class="finding-row"
            :class="{ 'finding-row--active': selectedFinding?.id === finding.id }"
            :aria-current="selectedFinding?.id === finding.id ? 'true' : undefined"
            @click="selectFinding(finding)"
          >
            <div class="finding-row__topline">
              <SeverityBadge :severity="finding.severity" compact />
              <span class="finding-row__tool">{{ finding.tool }}</span>
              <ChevronRight class="finding-row__chevron" :size="14" aria-hidden="true" />
            </div>
            <strong class="finding-row__rule mono">{{ finding.ruleId }}</strong>
            <span class="finding-row__message">{{ finding.message }}</span>
            <div class="finding-row__location mono">
              <FileSearch :size="12" />
              <template v-if="finding.locations[0]">
                {{ finding.locations[0].file }}:{{ finding.locations[0].lineStart }}
              </template>
              <template v-else>No location</template>
            </div>
          </button>
        </div>

        <div v-else class="list-empty">
          <NEmpty description="No findings match these filters." />
        </div>

        <footer class="list-pagination">
          <span class="mono">Page {{ page }} / {{ pageCount }}</span>
          <NPagination v-model:page="page" :page-count="pageCount" :page-slot="5" size="small" />
        </footer>
      </section>

      <section v-if="!isTablet" class="findings-detail" aria-label="Finding details">
        <FindingDetailPanel :finding="selectedFinding" />
      </section>
    </div>

    <div v-else class="empty-report panel">
      <ShieldCheck :size="30" />
      <NEmpty description="No valid scan reports are available." />
      <span>The selected report may be missing or malformed.</span>
    </div>

    <NDrawer
      v-if="isTablet"
      v-model:show="detailDrawerOpen"
      placement="right"
      width="min(760px, 92vw)"
      :trap-focus="true"
    >
      <NDrawerContent body-content-style="padding: 0; height: 100%;" closable>
        <FindingDetailPanel :finding="selectedFinding" show-close @close="detailDrawerOpen = false" />
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.findings-page {
  display: flex;
  height: 100dvh;
  min-height: 780px;
  flex-direction: column;
}

.project-picker {
  width: min(320px, 35vw);
}

.project-picker label {
  display: block;
  margin-bottom: 8px;
  color: #a5ada9;
  font-size: 12px;
  font-weight: 630;
}

.load-alert {
  flex: 0 0 auto;
  margin-bottom: 18px;
}

.loading-shell {
  display: grid;
  gap: 22px;
  padding: 24px;
}

.findings-workspace {
  display: grid;
  overflow: hidden;
  min-height: 650px;
  flex: 1;
  grid-template-columns: minmax(380px, 400px) minmax(0, 1fr);
}

.findings-master {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex-direction: column;
  border-right: 1px solid #283036;
}

.report-summary {
  display: grid;
  align-items: center;
  gap: 12px 16px;
  padding: 17px 18px 15px;
  grid-template-columns: minmax(0, 1fr) auto;
  border-bottom: 1px solid #283036;
  background: #111518;
}

.report-summary__identity {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.report-summary__name {
  overflow: hidden;
  color: #e4e7e2;
  font-size: 14px;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-summary .mono {
  color: #727c82;
  font-size: 10px;
}

.report-summary__total {
  color: #c6cdc8;
  font-size: 12px;
  font-weight: 620;
}

.report-counts {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.report-count {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: #818b90;
  font-size: 10px;
}

.report-count b {
  color: currentColor;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
}

.report-count--critical {
  color: #ff5d68;
}

.report-count--high {
  color: #ff8a58;
}

.report-count--medium {
  color: #e7b84b;
}

.report-count--low {
  color: #66b5f6;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px 13px;
  border-bottom: 1px solid #283036;
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.filter-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 20px;
  color: #79848a;
  font-size: 11px;
}

.filter-summary span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.filter-summary button {
  padding: 0;
  border: 0;
  color: #b7ef45;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 620;
}

.finding-list {
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}

.finding-row {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
  border: 0;
  border-bottom: 1px solid #242b30;
  color: inherit;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 120ms ease, box-shadow 120ms ease;
}

.finding-row:hover {
  background: #13191c;
}

.finding-row--active {
  background: #151b1e;
  box-shadow: inset 3px 0 #b7ef45;
}

.finding-row__topline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.finding-row__tool {
  padding: 2px 7px;
  border: 1px solid #343c42;
  border-radius: 999px;
  color: #929ca1;
  font-size: 10px;
  font-weight: 600;
}

.finding-row__chevron {
  margin-left: auto;
  color: #515b61;
}

.finding-row--active .finding-row__chevron {
  color: #b7ef45;
}

.finding-row__rule {
  overflow: hidden;
  color: #dce0da;
  font-size: 12px;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.finding-row__message {
  display: -webkit-box;
  overflow: hidden;
  color: #9ba4a7;
  font-size: 12px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.finding-row__location {
  display: flex;
  overflow: hidden;
  align-items: center;
  gap: 5px;
  color: #737d82;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-empty {
  display: grid;
  min-height: 250px;
  flex: 1;
  place-items: center;
  padding: 24px;
}

.list-pagination {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 18px;
  border-top: 1px solid #283036;
  background: #111518;
}

.list-pagination > span {
  color: #747f84;
  font-size: 10px;
}

.findings-detail {
  overflow: hidden;
  min-width: 0;
  height: 100%;
}

.empty-report {
  display: flex;
  min-height: 500px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #667177;
}

.empty-report > span {
  font-size: 12px;
}

@media (max-width: 1199px) {
  .findings-page {
    height: auto;
  }

  .findings-workspace {
    display: block;
    height: auto;
    min-height: 680px;
  }

  .findings-master {
    min-height: 680px;
    border-right: 0;
  }
}

@media (max-width: 760px) {
  .project-picker {
    width: 100%;
  }
}
</style>
