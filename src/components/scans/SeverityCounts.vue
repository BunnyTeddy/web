<script setup lang="ts">
import type { SeverityCounts } from '@/domain/types'

defineProps<{
  counts: SeverityCounts
  showUnknown?: boolean
}>()
</script>

<template>
  <span class="severity-counts" aria-label="Finding counts by severity">
    <span class="count critical" :aria-label="`${counts.critical} critical`">
      <b>C</b>{{ counts.critical }}
    </span>
    <span class="count high" :aria-label="`${counts.high} high`"><b>H</b>{{ counts.high }}</span>
    <span class="count medium" :aria-label="`${counts.medium} medium`">
      <b>M</b>{{ counts.medium }}
    </span>
    <span class="count low" :aria-label="`${counts.low} low`"><b>L</b>{{ counts.low }}</span>
    <span
      v-if="showUnknown && counts.unknown"
      class="count unknown"
      :aria-label="`${counts.unknown} unknown`"
    >
      <b>U</b>{{ counts.unknown }}
    </span>
  </span>
</template>

<style scoped>
.severity-counts {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  white-space: nowrap;
}

.count {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #9aa2a7;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 11px;
}

.count b {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: var(--radius-compact);
  font-family: inherit;
  font-size: 9px;
  font-weight: 800;
}

.critical {
  color: #f08076;
}

.high {
  color: #ee9a61;
}

.medium {
  color: #e1bf5e;
}

.low {
  color: #6aafe2;
}

.unknown {
  color: #9aa2a7;
}
</style>
