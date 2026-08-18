<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleX, Database, Terminal } from '@lucide/vue'

import type { ClientStatus, RuntimeInfo } from '@/domain/types'

const props = defineProps<{
  runtime: RuntimeInfo
  status: ClientStatus
  reportCount: number
  findingCount: number
  jobCount: number
}>()

const checkedAt = computed(() => {
  if (!props.status.checkedAt) return 'Not checked yet'
  const date = new Date(props.status.checkedAt)
  return Number.isNaN(date.valueOf()) ? props.status.checkedAt : date.toLocaleString()
})
</script>

<template>
  <section class="runtime-panel panel" aria-labelledby="runtime-title">
    <header class="runtime-panel__header">
      <div>
        <h2 id="runtime-title">Runtime</h2>
        <p>CLI environment and connection details</p>
      </div>
    </header>

    <div class="connection-state" :class="{ 'connection-state--online': status.connected }">
      <component :is="status.connected ? CircleCheck : CircleX" :size="18" />
      <div>
        <strong>{{ status.connected ? 'Scanner API reachable' : 'Scanner API offline' }}</strong>
        <span>{{ status.message }}</span>
      </div>
    </div>

    <dl class="runtime-properties">
      <div>
        <dt>CLI version</dt>
        <dd class="mono">{{ runtime.version }}</dd>
      </div>
      <div>
        <dt>Platform</dt>
        <dd class="mono">{{ runtime.platform }}</dd>
      </div>
      <div class="runtime-properties__wide">
        <dt>Binary</dt>
        <dd class="mono"><Terminal :size="13" /> {{ runtime.binaryPath }}</dd>
      </div>
      <div class="runtime-properties__wide">
        <dt>Last connection check</dt>
        <dd>{{ checkedAt }}</dd>
      </div>
    </dl>

    <div class="local-data">
      <div class="local-data__heading">
        <Database :size="14" />
        <span>Workspace index</span>
      </div>
      <div class="local-data__stats">
        <div><strong>{{ jobCount }}</strong><span>Jobs</span></div>
        <div><strong>{{ reportCount }}</strong><span>Reports</span></div>
        <div><strong>{{ findingCount }}</strong><span>Findings</span></div>
      </div>
      <p>Reports and findings currently available in this workspace.</p>
    </div>
  </section>
</template>

<style scoped>
.runtime-panel {
  overflow: hidden;
}

.runtime-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 22px 20px;
  border-bottom: 1px solid #283036;
}

.runtime-panel__header h2 {
  margin: 0;
  color: #ecefeb;
  font-size: 17px;
  font-weight: 680;
  letter-spacing: -0.015em;
}

.runtime-panel__header p {
  margin: 5px 0 0;
  color: #7f898e;
  font-size: 12px;
  line-height: 1.45;
}

.connection-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 19px 22px;
  border-bottom: 1px solid #283036;
  color: #e4756d;
}

.connection-state--online {
  color: #78cba1;
}

.connection-state > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.connection-state strong {
  color: #dce1dc;
  font-size: 13px;
  font-weight: 650;
}

.connection-state span {
  overflow: hidden;
  color: #7f898e;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-properties {
  display: grid;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.runtime-properties > div {
  min-width: 0;
  padding: 17px 22px;
  border-bottom: 1px solid #283036;
}

.runtime-properties > div:nth-child(odd):not(.runtime-properties__wide) {
  border-right: 1px solid #283036;
}

.runtime-properties__wide {
  grid-column: 1 / -1;
}

.runtime-properties > div:last-child {
  border-bottom: 0;
}

.runtime-properties dt {
  margin-bottom: 6px;
  color: #7f898e;
  font-size: 11px;
  font-weight: 620;
}

.runtime-properties dd {
  display: flex;
  overflow: hidden;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: #cbd1cc;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-data {
  padding: 20px 22px 22px;
}

.local-data__heading {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #d4d9d4;
  font-size: 13px;
  font-weight: 650;
}

.local-data__stats {
  display: grid;
  margin-top: 16px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-block: 1px solid #283036;
}

.local-data__stats > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 15px 12px;
}

.local-data__stats > div + div {
  border-left: 1px solid #283036;
}

.local-data__stats strong {
  color: #e1e5df;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 19px;
}

.local-data__stats span {
  color: #7c878c;
  font-size: 11px;
}

.local-data p {
  margin: 13px 0 0;
  color: #747f84;
  font-size: 11px;
  line-height: 1.5;
}
</style>
