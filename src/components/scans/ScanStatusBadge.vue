<script setup lang="ts">
import { CircleCheck, CircleSlash, CircleX, Clock3, LoaderCircle, UploadCloud } from '@lucide/vue'
import { computed } from 'vue'

import type { JobStatus } from '@/domain/types'

const props = defineProps<{
  status: JobStatus
  compact?: boolean
}>()

const content = computed(() => {
  switch (props.status) {
    case 'queued':
      return { label: 'Queued', icon: Clock3 }
    case 'uploading':
      return { label: 'Uploading', icon: UploadCloud }
    case 'running':
      return { label: 'Running', icon: LoaderCircle }
    case 'completed':
      return { label: 'Completed', icon: CircleCheck }
    case 'failed':
      return { label: 'Failed', icon: CircleX }
    case 'cancelled':
      return { label: 'Cancelled', icon: CircleSlash }
    default:
      return { label: props.status, icon: Clock3 }
  }
})
</script>

<template>
  <span class="status-badge" :class="[`is-${status}`, { compact }]">
    <component
      :is="content.icon"
      :size="compact ? 11 : 12"
      :class="{ spin: status === 'running' }"
      aria-hidden="true"
    />
    <span>{{ content.label }}</span>
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  min-width: 90px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 5px 9px;
  border: 1px solid #374047;
  border-radius: 999px;
  color: #aeb5ba;
  background: #14191d;
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
  white-space: nowrap;
}

.status-badge.compact {
  min-width: 0;
  padding: 5px 8px;
  font-size: 10px;
}

.is-completed {
  border-color: #38513d;
  color: #8fc680;
  background: #121916;
}

.is-running,
.is-uploading {
  border-color: #33536b;
  color: #76b7ea;
  background: #111923;
}

.is-queued {
  border-color: #5a5130;
  color: #e4c05d;
  background: #1b1810;
}

.is-failed {
  border-color: #653833;
  color: #f08274;
  background: #1d1212;
}

.is-cancelled {
  color: #858d93;
}

.spin {
  animation: spin 1.4s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
