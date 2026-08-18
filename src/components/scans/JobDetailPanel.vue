<script setup lang="ts">
import {
  ArrowUpRight,
  Ban,
  CalendarClock,
  FileJson2,
  FolderGit2,
  Gauge,
  Hash,
  ListTree,
  TerminalSquare,
} from '@lucide/vue'
import { NAlert, NButton, NProgress } from 'naive-ui'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import type { ScanJob } from '@/domain/types'

import ScanStatusBadge from './ScanStatusBadge.vue'
import SeverityCounts from './SeverityCounts.vue'

const props = defineProps<{
  job: ScanJob
  cancelling?: boolean
}>()

const emit = defineEmits<{
  cancel: [job: ScanJob]
  view: [job: ScanJob]
}>()

const isActive = computed(() => ['queued', 'uploading', 'running'].includes(props.job.status))
const isComplete = computed(() => props.job.status === 'completed' && Boolean(props.job.reportScanId))
const terminalRef = ref<HTMLElement | null>(null)
const shouldFollowActivityTail = ref(true)

const ACTIVITY_TAIL_THRESHOLD = 28

function isNearActivityTail(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= ACTIVITY_TAIL_THRESHOLD
}

function handleActivityScroll() {
  if (!terminalRef.value) return
  shouldFollowActivityTail.value = isNearActivityTail(terminalRef.value)
}

function scrollActivityToTail() {
  if (!terminalRef.value) return
  terminalRef.value.scrollTop = terminalRef.value.scrollHeight
}

onMounted(() => {
  scrollActivityToTail()
})

watch(
  [() => props.job.id, () => props.job.activity.length],
  async ([jobId], [previousJobId]) => {
    const jobChanged = jobId !== previousJobId
    if (jobChanged) shouldFollowActivityTail.value = true

    await nextTick()
    if (jobChanged || shouldFollowActivityTail.value) scrollActivityToTail()
  },
  { flush: 'post' },
)

function formatTimestamp(value: string | null) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false,
  }).format(date)
}
</script>

<template>
  <article class="detail-panel">
    <div class="detail-summary-scroll">
      <header class="detail-header">
        <div class="detail-project">
          <span class="project-icon"><FolderGit2 :size="16" aria-hidden="true" /></span>
          <div>
            <span class="eyebrow">Selected scan</span>
            <h2>{{ job.projectName }}</h2>
          </div>
        </div>
        <ScanStatusBadge :status="job.status" compact />
      </header>

      <div class="job-path mono" :title="job.projectPath">{{ job.projectPath }}</div>

      <section class="progress-block" aria-label="Job progress">
        <div class="progress-heading">
          <span>Progress</span>
          <strong class="mono">{{ job.progress }}%</strong>
        </div>
        <NProgress
          type="line"
          :percentage="job.progress"
          :height="5"
          :border-radius="2"
          :show-indicator="false"
          :status="job.status === 'failed' ? 'error' : job.status === 'completed' ? 'success' : 'default'"
        />
        <p v-if="isActive" class="progress-note" role="status" aria-live="polite">
          Processing continues in the background.
        </p>
      </section>

      <section class="metadata-grid" aria-label="Job metadata">
        <div>
          <Hash :size="13" aria-hidden="true" />
          <span>Job ID</span>
          <code :title="job.id">{{ job.id.slice(0, 13) }}</code>
        </div>
        <div>
          <Gauge :size="13" aria-hidden="true" />
          <span>Mode</span>
          <strong>{{ job.mode }}</strong>
        </div>
        <div>
          <FileJson2 :size="13" aria-hidden="true" />
          <span>Format</span>
          <strong>{{ job.format }}</strong>
        </div>
        <div>
          <CalendarClock :size="13" aria-hidden="true" />
          <span>Started</span>
          <strong>{{ formatTimestamp(job.startedAt) }}</strong>
        </div>
      </section>

      <NAlert v-if="job.error" type="error" :bordered="true" class="job-error">
        {{ job.error }}
      </NAlert>

      <section class="finding-summary">
        <div class="section-heading">
          <span><ListTree :size="13" aria-hidden="true" /> Findings</span>
          <strong class="mono">{{ job.findingCount }}</strong>
        </div>
        <SeverityCounts :counts="job.severityCounts" show-unknown />
      </section>
    </div>

    <section class="activity-section">
      <div class="section-heading">
        <span><TerminalSquare :size="13" aria-hidden="true" /> Scan activity</span>
        <span class="activity-count mono">{{ job.activity.length }} events</span>
      </div>
      <div
        ref="terminalRef"
        class="terminal"
        role="log"
        aria-label="Scan activity"
        aria-live="polite"
        aria-relevant="additions text"
        tabindex="0"
        @scroll.passive="handleActivityScroll"
      >
        <p v-if="job.activity.length === 0" class="terminal-empty">No activity recorded yet.</p>
        <p v-for="(event, index) in job.activity" :key="`${job.id}-${index}`">
          <span class="activity-sequence">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="activity-message">{{ event }}</span>
        </p>
      </div>
    </section>

    <footer class="detail-actions">
      <NButton
        v-if="isActive"
        type="error"
        secondary
        :loading="cancelling"
        @click="emit('cancel', job)"
      >
        <template #icon><Ban :size="15" /></template>
        Cancel scan
      </NButton>
      <NButton v-if="isComplete" type="primary" @click="emit('view', job)">
        View findings
        <template #icon><ArrowUpRight :size="15" /></template>
      </NButton>
      <span v-if="!isActive && !isComplete" class="terminal-state">
        No report is available for this job.
      </span>
    </footer>
  </article>
</template>

<style scoped>
.detail-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: #101417;
}

.detail-summary-scroll {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 20px 15px;
  flex: 0 0 auto;
}

.detail-project {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.project-icon {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #35402b;
  border-radius: 5px;
  color: #b7ef45;
  background: #151b13;
}

.detail-project > div {
  min-width: 0;
}

.detail-project h2 {
  margin: 4px 0 0;
  overflow: hidden;
  color: #f1f3ee;
  font-size: 16px;
  font-weight: 640;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-path {
  flex: 0 0 auto;
  margin: 0 20px;
  padding: 10px 11px;
  overflow: hidden;
  border: 1px solid #273037;
  border-radius: 4px;
  color: #858f95;
  background: #0b0f11;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-block {
  flex: 0 0 auto;
  padding: 20px;
  border-bottom: 1px solid #252c31;
}

.progress-heading,
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: #90999e;
  font-size: 12px;
  font-weight: 620;
}

.progress-heading strong {
  color: #cbd2cc;
}

.progress-note {
  margin: 10px 0 0;
  color: #737e84;
  font-size: 11px;
}

.metadata-grid {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: 1fr 1fr;
  column-gap: 20px;
  padding: 4px 20px;
  border-bottom: 1px solid #252c31;
}

.metadata-grid > div {
  display: grid;
  min-width: 0;
  grid-template-columns: auto 1fr;
  gap: 6px 8px;
  padding: 14px 0;
  border-bottom: 1px solid #22292e;
  color: #707a80;
}

.metadata-grid > div:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.metadata-grid svg {
  grid-row: span 2;
  margin-top: 1px;
}

.metadata-grid span {
  font-size: 11px;
  font-weight: 600;
}

.metadata-grid strong,
.metadata-grid code {
  overflow: hidden;
  color: #c5cac6;
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  text-transform: capitalize;
  white-space: nowrap;
}

.job-error {
  margin: 18px 20px 0;
}

.finding-summary,
.activity-section {
  padding: 19px 20px;
  border-bottom: 1px solid #252c31;
}

.finding-summary {
  flex: 0 0 auto;
}

.section-heading span:first-child {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.section-heading strong {
  color: #f0f2ed;
  font-size: 16px;
}

.activity-section {
  display: flex;
  min-height: 150px;
  max-height: 196px;
  flex: 0 0 clamp(150px, 22vh, 196px);
  flex-direction: column;
  overflow: hidden;
}

.activity-count {
  color: #717b81;
  font-size: 11px;
  font-weight: 500;
}

.terminal {
  min-height: 0;
  max-height: none;
  flex: 1 1 auto;
  padding: 12px;
  overflow-y: auto;
  border: 1px solid #252d32;
  border-radius: 4px;
  color: #a9b0b4;
  background: #090c0e;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 11px;
  line-height: 1.65;
  scrollbar-gutter: stable;
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.terminal:focus-visible {
  border-color: #789c39;
  box-shadow: 0 0 0 2px rgb(183 239 69 / 12%);
  outline: none;
}

.terminal p {
  display: grid;
  min-width: 0;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 7px;
  margin: 0 0 4px;
}

.terminal p:last-child {
  margin-bottom: 0;
}

.activity-sequence {
  color: #8da76b;
  font-weight: 650;
  user-select: none;
}

.activity-message {
  min-width: 0;
  color: #b9c0bc;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.terminal .terminal-empty {
  display: block;
  color: #626c73;
}

.detail-actions {
  position: sticky;
  z-index: 2;
  bottom: 0;
  display: flex;
  flex: 0 0 auto;
  min-height: 70px;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 13px 20px;
  border-top: 1px solid #252c31;
  background: #101417;
}

.terminal-state {
  color: #697279;
  font-size: 12px;
}
</style>
