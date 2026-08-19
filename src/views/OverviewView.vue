<script setup lang="ts">
import {
  ArrowRight,
  Bug,
  CircleCheck,
  Database,
  FolderKanban,
  Plus,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from '@lucide/vue'
import { NAlert, NButton } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/layout/PageHeader.vue'
import NewScanDrawer from '@/components/scans/NewScanDrawer.vue'
import ScanTable from '@/components/scans/ScanTable.vue'
import type { ScanCreateInput, ScanJob } from '@/domain/types'
import { useReportsStore } from '@/stores/reports'
import { useScansStore } from '@/stores/scans'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const reportsStore = useReportsStore()
const scansStore = useScansStore()
const settingsStore = useSettingsStore()

const initializing = ref(true)
const initError = ref('')
const drawerOpen = ref(false)
const selectedDirectory = ref('')
const choosingDirectory = ref(false)
const creatingScan = ref(false)
const createError = ref('')

const recentJobs = computed(() =>
  [...scansStore.jobs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3),
)

const totalFindings = computed(() => reportsStore.totals.total)
const priorityFindings = computed(
  () => reportsStore.totals.critical + reportsStore.totals.high,
)
const completedJobs = computed(
  () => scansStore.jobs.filter((job) => job.status === 'completed').length,
)
const projectCount = computed(
  () => new Set(reportsStore.reports.map((report) => report.projectSlug)).size,
)

const endpointLabel = computed(() => {
  const value = settingsStore.status.serverUrl || settingsStore.settings.serverUrl
  if (!value) return 'Not configured'
  try {
    return new URL(value).host
  } catch {
    return value
  }
})

const severitySummary = computed(() => {
  const items = [
    {
      key: 'critical',
      label: 'Critical',
      value: reportsStore.totals.critical,
      hint: 'Immediate action',
    },
    {
      key: 'high',
      label: 'High',
      value: reportsStore.totals.high,
      hint: 'Prioritize next',
    },
    {
      key: 'medium',
      label: 'Medium',
      value: reportsStore.totals.medium,
      hint: 'Review this cycle',
    },
    {
      key: 'low',
      label: 'Low',
      value: reportsStore.totals.low,
      hint: 'Track and harden',
    },
  ]
  if (reportsStore.totals.unknown > 0) {
    items.push({
      key: 'unknown',
      label: 'Unknown',
      value: reportsStore.totals.unknown,
      hint: 'Needs classification',
    })
  }
  return items
})

const workspaceMetrics = computed(() => [
  { label: 'Projects analyzed', value: projectCount.value, icon: FolderKanban },
  { label: 'Completed scans', value: completedJobs.value, icon: CircleCheck },
  { label: 'Active jobs', value: scansStore.activeJobs.length, icon: RefreshCw },
])

async function initialize() {
  initializing.value = true
  initError.value = ''
  try {
    await Promise.all([reportsStore.initialize(), scansStore.initialize()])
  } catch (error) {
    initError.value = error instanceof Error ? error.message : 'Unable to load dashboard data.'
  } finally {
    initializing.value = false
  }
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
    drawerOpen.value = false
    await router.push({ path: '/scans', query: { job: job.id } })
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'The scan could not be created.'
  } finally {
    creatingScan.value = false
  }
}

function openJob(job: ScanJob) {
  if (job.status === 'completed' && job.reportScanId) {
    void router.push({
      name: 'scan-findings',
      params: { scanId: job.reportScanId },
      query: { scope: 'scan', job: job.id },
    })
    return
  }
  void router.push({ path: '/scans', query: { job: job.id } })
}

function reviewFindings() {
  void router.push('/findings')
}

onMounted(initialize)
</script>

<template>
  <div class="page-shell overview-page">
    <PageHeader
      kicker="Security posture"
      title="Overview"
      description="Monitor scans and prioritize findings from one local workspace."
    >
      <template #actions>
        <NButton :loading="initializing" aria-label="Refresh dashboard" @click="initialize">
          <template #icon><RefreshCw :size="15" /></template>
          Refresh
        </NButton>
        <NButton type="primary" @click="drawerOpen = true">
          <template #icon><Plus :size="16" /></template>
          New scan
        </NButton>
      </template>
    </PageHeader>

    <NAlert v-if="initError || reportsStore.error || scansStore.error" type="error" :bordered="true">
      {{ initError || reportsStore.error || scansStore.error }}
    </NAlert>

    <div class="command-grid" aria-label="Overview command center">
      <section class="risk-card panel" aria-labelledby="risk-posture-title">
        <header class="card-heading">
          <div class="heading-group">
            <span class="heading-icon heading-icon--lime" aria-hidden="true">
              <ShieldCheck :size="17" :stroke-width="1.8" />
            </span>
            <div>
              <h2 id="risk-posture-title">Risk posture</h2>
              <p>Finding severity across {{ projectCount }} analyzed projects</p>
            </div>
          </div>
          <span class="scope-chip"><Database :size="12" aria-hidden="true" /> All reports</span>
        </header>

        <div class="risk-overview">
          <div class="total-block">
            <span v-if="!initializing" class="total-number mono">{{ totalFindings }}</span>
            <span v-else class="value-skeleton value-skeleton--large" aria-label="Loading" />
            <span class="total-label">Total findings</span>
          </div>

          <div class="severity-overview">
            <div
              class="segmented-bar"
              role="img"
              :aria-label="`${reportsStore.totals.critical} critical, ${reportsStore.totals.high} high, ${reportsStore.totals.medium} medium, ${reportsStore.totals.low} low, ${reportsStore.totals.unknown} unknown findings`"
            >
              <span
                v-for="item in severitySummary"
                v-show="item.value > 0"
                :key="item.key"
                :class="`segment segment--${item.key}`"
                :style="{ flexGrow: item.value }"
              />
            </div>
            <div
              class="severity-grid"
              :style="{ gridTemplateColumns: `repeat(${severitySummary.length}, minmax(0, 1fr))` }"
            >
              <article
                v-for="item in severitySummary"
                :key="item.key"
                class="severity-item"
                :class="`severity-item--${item.key}`"
              >
                <span class="severity-label"><i aria-hidden="true" />{{ item.label }}</span>
                <strong class="mono">{{ item.value }}</strong>
                <small>{{ item.hint }}</small>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="attention-card panel" aria-labelledby="attention-title">
        <header class="card-heading">
          <div class="heading-group">
            <span class="heading-icon heading-icon--warning" aria-hidden="true">
              <ShieldAlert :size="17" :stroke-width="1.8" />
            </span>
            <div>
              <h2 id="attention-title">Needs attention</h2>
              <p>Highest-priority findings</p>
            </div>
          </div>
          <span class="priority-total mono">{{ priorityFindings }}</span>
        </header>

        <div class="attention-list">
          <button type="button" class="attention-row attention-row--critical" @click="reviewFindings">
            <span class="attention-symbol" aria-hidden="true">
              <TriangleAlert :size="15" />
            </span>
            <span>
              <strong>Critical</strong>
              <small>Immediate action required</small>
            </span>
            <b class="mono">{{ reportsStore.totals.critical }}</b>
          </button>
          <button type="button" class="attention-row attention-row--high" @click="reviewFindings">
            <span class="attention-symbol" aria-hidden="true">
              <TriangleAlert :size="15" />
            </span>
            <span>
              <strong>High</strong>
              <small>Prioritize for remediation</small>
            </span>
            <b class="mono">{{ reportsStore.totals.high }}</b>
          </button>
        </div>

        <NButton class="review-button" block @click="reviewFindings">
          <span>Review findings</span>
          <ArrowRight :size="14" aria-hidden="true" />
        </NButton>
      </section>

      <section class="recent-card panel" aria-labelledby="recent-scans-title">
        <header class="panel-header">
          <div>
            <span class="section-kicker">Latest activity</span>
            <h2 id="recent-scans-title">Recent scans</h2>
          </div>
          <NButton text type="primary" @click="router.push('/scans')">
            View all <ArrowRight :size="14" aria-hidden="true" />
          </NButton>
        </header>
        <ScanTable
          :jobs="recentJobs"
          :loading="initializing"
          :selected-id="scansStore.selectedJobId"
          compact
          @select="openJob"
        />
      </section>

      <aside class="right-rail" aria-label="Workspace status">
        <section class="health-card panel" aria-labelledby="scanner-health-title">
          <header class="rail-heading">
            <div>
              <span class="section-kicker">Runtime</span>
              <h2 id="scanner-health-title">Scanner health</h2>
            </div>
            <span class="connected-badge" :class="{ offline: !settingsStore.status.connected }">
              <i aria-hidden="true" />
              {{ settingsStore.status.connected ? 'Connected' : 'Offline' }}
            </span>
          </header>
          <dl class="health-details">
            <div>
              <dt><Server :size="13" aria-hidden="true" />Endpoint</dt>
              <dd class="mono" :title="endpointLabel">{{ endpointLabel }}</dd>
            </div>
            <div>
              <dt><ShieldCheck :size="13" aria-hidden="true" />Version</dt>
              <dd class="mono">{{ settingsStore.runtime.version }}</dd>
            </div>
          </dl>
        </section>

        <section class="workspace-card panel" aria-labelledby="workspace-overview-title">
          <header class="rail-heading">
            <div>
              <span class="section-kicker">Current session</span>
              <h2 id="workspace-overview-title">Workspace overview</h2>
            </div>
            <Bug :size="17" aria-hidden="true" />
          </header>
          <div class="workspace-metrics">
            <div v-for="metric in workspaceMetrics" :key="metric.label">
              <span>
                <component :is="metric.icon" :size="14" aria-hidden="true" />
                {{ metric.label }}
              </span>
              <strong class="mono">{{ metric.value }}</strong>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <NewScanDrawer
      v-model:show="drawerOpen"
      :project-path="selectedDirectory"
      :choosing="choosingDirectory"
      :submitting="creatingScan"
      :error="createError"
      @choose="chooseDirectory"
      @submit="createScan"
    />
  </div>
</template>

<style scoped>
.overview-page {
  min-height: 100vh;
}

.overview-page > :deep(.n-alert) {
  margin-bottom: 18px;
}

.overview-page :deep(.page-header__actions .n-button) {
  height: 38px;
}

.command-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: stretch;
  gap: 18px;
}

.risk-card,
.attention-card,
.recent-card,
.right-rail {
  min-width: 0;
}

.risk-card {
  grid-column: span 8;
  min-height: 222px;
  padding: 20px 22px;
}

.attention-card {
  display: flex;
  grid-column: span 4;
  min-height: 222px;
  flex-direction: column;
  padding: 20px;
}

.card-heading,
.rail-heading,
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.heading-group {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}

.heading-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border: 1px solid #2a3237;
  border-radius: var(--radius-control);
  place-items: center;
  background: #141a1d;
}

.heading-icon--lime {
  border-color: #35422d;
  color: #b7ef45;
  background: #171d16;
}

.heading-icon--warning {
  border-color: #413027;
  color: #f19763;
  background: #1c1715;
}

.card-heading h2,
.rail-heading h2,
.panel-header h2 {
  margin: 0;
  color: #edf0eb;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.card-heading p {
  margin: 3px 0 0;
  color: #747e84;
  font-size: 11px;
}

.scope-chip {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid #2c3439;
  border-radius: var(--radius-compact);
  color: #899399;
  font-size: 10px;
  font-weight: 600;
}

.risk-overview {
  display: grid;
  grid-template-columns: 138px minmax(0, 1fr);
  align-items: end;
  gap: 26px;
  margin-top: 25px;
}

.total-block {
  display: grid;
  align-content: end;
  padding-right: 24px;
  border-right: 1px solid #252d31;
}

.total-number {
  color: #f5f7f1;
  font-size: 48px;
  font-weight: 640;
  letter-spacing: -0.065em;
  line-height: 0.9;
}

.total-label {
  margin-top: 10px;
  color: #879097;
  font-size: 11px;
  font-weight: 600;
}

.severity-overview {
  min-width: 0;
}

.segmented-bar {
  display: flex;
  width: 100%;
  height: 8px;
  gap: 3px;
  overflow: hidden;
  border-radius: var(--radius-control);
  background: #252c31;
}

.segment {
  min-width: 3px;
  height: 100%;
}

.segment--critical {
  background: #f0716c;
}

.segment--high {
  background: #ef965f;
}

.segment--medium {
  background: #e2bf5b;
}

.segment--low {
  background: #67afe0;
}

.segment--unknown {
  background: #858f95;
}

.severity-grid {
  display: grid;
  gap: 10px;
  margin-top: 17px;
}

.severity-item {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.severity-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #929ba0;
  font-size: 10px;
  font-weight: 600;
}

.severity-label i {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-compact);
  background: var(--severity-color);
}

.severity-item strong {
  color: #e7eae5;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.15;
}

.severity-item small {
  overflow: hidden;
  color: #69737a;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.severity-item--critical {
  --severity-color: #f0716c;
}

.severity-item--high {
  --severity-color: #ef965f;
}

.severity-item--medium {
  --severity-color: #e2bf5b;
}

.severity-item--low {
  --severity-color: #67afe0;
}

.severity-item--unknown {
  --severity-color: #858f95;
}

.priority-total {
  min-width: 38px;
  color: #e9ece7;
  font-size: 22px;
  font-weight: 650;
  text-align: right;
}

.attention-list {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.attention-row {
  display: grid;
  width: 100%;
  min-height: 48px;
  grid-template-columns: 29px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid #282f34;
  border-radius: var(--radius-control);
  color: #cfd3ce;
  text-align: left;
  background: #121719;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease;
}

.attention-row:hover {
  border-color: #3a4348;
  background: #151b1e;
}

.attention-symbol {
  display: grid;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-control);
  place-items: center;
}

.attention-row--critical .attention-symbol {
  color: #f0716c;
  background: #251819;
}

.attention-row--high .attention-symbol {
  color: #ef965f;
  background: #241b17;
}

.attention-row > span:nth-child(2) {
  display: grid;
  min-width: 0;
}

.attention-row strong {
  font-size: 11px;
  font-weight: 650;
}

.attention-row small {
  overflow: hidden;
  color: #737d83;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attention-row b {
  color: #f0f2ee;
  font-size: 16px;
  font-weight: 650;
}

.review-button {
  height: 34px;
  margin-top: auto;
}

.review-button :deep(.n-button__content) {
  gap: 6px;
}

.recent-card {
  grid-column: span 8;
  overflow: hidden;
}

.panel-header {
  min-height: 66px;
  padding: 12px 18px;
  border-bottom: 1px solid #283036;
}

.section-kicker {
  display: block;
  margin-bottom: 4px;
  color: #768188;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.right-rail {
  display: grid;
  grid-column: span 4;
  grid-template-rows: auto 1fr;
  gap: 18px;
}

.health-card,
.workspace-card {
  padding: 17px 18px;
}

.rail-heading svg {
  color: #68747a;
}

.connected-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #a6dc65;
  font-size: 10px;
  font-weight: 650;
}

.connected-badge i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9bdd45;
}

.connected-badge.offline {
  color: #e0af58;
}

.connected-badge.offline i {
  background: #e0af58;
}

.health-details {
  display: grid;
  margin: 13px 0 0;
}

.health-details > div,
.workspace-metrics > div {
  display: grid;
  min-width: 0;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 9px 0;
  border-top: 1px solid #232a2f;
}

.health-details dt,
.workspace-metrics span {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  color: #7f898f;
  font-size: 10px;
}

.health-details dd {
  max-width: 160px;
  margin: 0;
  overflow: hidden;
  color: #c5cac5;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-metrics {
  display: grid;
  margin-top: 13px;
}

.workspace-metrics strong {
  color: #e7eae5;
  font-size: 13px;
  font-weight: 650;
}

.value-skeleton {
  display: block;
  border-radius: var(--radius-panel);
  background: #20272c;
  animation: pulse 1.3s ease-in-out infinite alternate;
}

.value-skeleton--large {
  width: 86px;
  height: 44px;
}

@keyframes pulse {
  to {
    opacity: 0.45;
  }
}

@media (max-width: 1280px) {
  .recent-card {
    grid-column: span 12;
  }

  .right-rail {
    grid-column: span 12;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: none;
  }
}

@media (max-width: 1180px) {
  .risk-card,
  .attention-card {
    grid-column: span 6;
  }
}

@media (max-width: 940px) {
  .risk-card,
  .attention-card,
  .recent-card,
  .right-rail {
    grid-column: span 12;
  }

  .right-rail {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 800px) {
  .risk-overview {
    grid-template-columns: 115px minmax(0, 1fr);
    gap: 18px;
  }

  .severity-item small {
    display: none;
  }
}
</style>
