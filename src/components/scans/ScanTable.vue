<script setup lang="ts">
import { ChevronRight, Inbox } from '@lucide/vue'

import type { ScanJob } from '@/domain/types'

import ScanStatusBadge from './ScanStatusBadge.vue'
import SeverityCounts from './SeverityCounts.vue'

defineProps<{
  jobs: ScanJob[]
  selectedId?: string | null
  loading?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  select: [job: ScanJob]
}>()

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatDuration(job: ScanJob) {
  if (!job.startedAt) return '—'
  const start = new Date(job.startedAt).getTime()
  const end = job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—'
  const totalSeconds = Math.floor((end - start) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}
</script>

<template>
  <div class="table-shell" :class="{ compact }">
    <div v-if="loading" class="table-loading" role="status" aria-live="polite">
      <span v-for="index in 5" :key="index" class="loading-row" />
      <span class="sr-only">Loading scan jobs</span>
    </div>

    <div v-else-if="jobs.length === 0" class="table-empty">
      <Inbox :size="23" :stroke-width="1.5" aria-hidden="true" />
      <strong>No scan jobs found</strong>
      <span>Adjust the filters or start a new scan.</span>
    </div>

    <div v-else class="table-scroll">
      <table>
        <thead>
          <tr>
            <th class="col-project" scope="col">Project</th>
            <th class="col-status" scope="col">Status</th>
            <th class="col-mode" scope="col">Mode</th>
            <th class="col-findings" scope="col">Findings</th>
            <th v-if="!compact" class="col-severity" scope="col">Severity</th>
            <th class="col-started" scope="col">Started</th>
            <th v-if="!compact" class="col-duration" scope="col">Duration</th>
            <th class="col-open" scope="col"><span class="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="job in jobs"
            :key="job.id"
            :class="{ selected: selectedId === job.id }"
            @click="emit('select', job)"
          >
            <td class="col-project">
              <button class="project-button" type="button" @click.stop="emit('select', job)">
                <span class="project-name">{{ job.projectName }}</span>
                <span class="project-id mono">{{ job.id.slice(0, 10) }}</span>
              </button>
            </td>
            <td class="col-status"><ScanStatusBadge :status="job.status" compact /></td>
            <td class="col-mode"><span class="mode-chip mono">{{ job.mode }}</span></td>
            <td class="col-findings">
              <span class="finding-total mono">{{ job.findingCount }}</span>
            </td>
            <td v-if="!compact" class="col-severity">
              <SeverityCounts :counts="job.severityCounts" />
            </td>
            <td class="col-started date-cell">{{ formatDate(job.startedAt ?? job.createdAt) }}</td>
            <td v-if="!compact" class="col-duration duration-cell mono">{{ formatDuration(job) }}</td>
            <td class="col-open chevron-cell">
              <ChevronRight :size="15" aria-hidden="true" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.table-shell {
  min-width: 0;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 740px;
  table-layout: fixed;
  border-collapse: collapse;
}

.compact table {
  min-width: 700px;
}

th {
  height: 44px;
  padding: 0 12px;
  border-bottom: 1px solid #283036;
  color: #7e888e;
  font-size: 11px;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}

td {
  height: 68px;
  padding: 0 12px;
  border-bottom: 1px solid #20272c;
  color: #c1c6c2;
  font-size: 12px;
  white-space: nowrap;
}

tbody tr {
  cursor: pointer;
  transition: background 100ms ease;
}

tbody tr:hover,
tbody tr.selected {
  background: #141a1d;
}

tbody tr.selected {
  box-shadow: inset 2px 0 #b7ef45;
}

tbody tr:last-child td {
  border-bottom: 0;
}

.project-button {
  display: grid;
  min-width: 0;
  gap: 4px;
  padding: 0;
  border: 0;
  color: inherit;
  text-align: left;
  background: none;
  cursor: pointer;
}

.project-name {
  max-width: 220px;
  overflow: hidden;
  color: #eef0eb;
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
}

.col-project {
  width: 154px;
}

.col-status {
  width: 104px;
}

.col-mode {
  width: 58px;
}

.col-findings {
  width: 68px;
}

.col-severity {
  width: 154px;
}

.col-started {
  width: 102px;
}

.col-duration {
  width: 72px;
}

.col-open {
  width: 28px;
}

.compact .col-project {
  width: 220px;
}

.compact .col-status {
  width: 150px;
}

.compact .col-mode,
.compact .col-findings {
  width: 100px;
}

.compact .col-started {
  width: 120px;
}

.project-id {
  color: #687279;
  font-size: 10px;
}

.mode-chip {
  display: inline-block;
  padding: 4px 7px;
  border: 1px solid #323a40;
  border-radius: 3px;
  color: #a3abb0;
  font-size: 10px;
  text-transform: capitalize;
}

.finding-total {
  color: #eef0eb;
  font-size: 13px;
  font-weight: 700;
}

.date-cell,
.duration-cell {
  color: #929b9f;
  font-size: 11px;
}

.chevron-cell {
  width: 34px;
  padding-left: 4px;
  color: #69737a;
}

.table-loading {
  display: grid;
  gap: 1px;
}

.loading-row {
  height: 68px;
  border-bottom: 1px solid #20272c;
  background: #171d21;
  animation: loading 1.2s ease-in-out infinite alternate;
}

.table-empty {
  display: grid;
  min-height: 290px;
  place-content: center;
  justify-items: center;
  gap: 8px;
  color: #69737a;
  text-align: center;
}

.table-empty strong {
  color: #bdc3bf;
  font-size: 13px;
}

.table-empty span {
  font-size: 11px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes loading {
  to {
    opacity: 0.48;
  }
}
</style>
