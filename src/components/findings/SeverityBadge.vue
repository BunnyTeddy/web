<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  severity?: string | null
  compact?: boolean
}>()

const normalizedSeverity = computed(() => (props.severity || 'unknown').toLowerCase())
const severityLabel = computed(
  () => normalizedSeverity.value.charAt(0).toUpperCase() + normalizedSeverity.value.slice(1),
)
</script>

<template>
  <span
    class="severity-badge"
    :class="[`severity-badge--${normalizedSeverity}`, { 'severity-badge--compact': compact }]"
  >
    <span class="severity-badge__dot" aria-hidden="true" />
    {{ severityLabel }}
  </span>
</template>

<style scoped>
.severity-badge {
  --severity-color: #8f979d;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: max-content;
  color: var(--severity-color);
  font-size: 12px;
  font-weight: 670;
  line-height: 1;
}

.severity-badge__dot {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: var(--severity-color);
}

.severity-badge--critical {
  --severity-color: #ff5d68;
}

.severity-badge--high {
  --severity-color: #ff8a58;
}

.severity-badge--medium {
  --severity-color: #e7b84b;
}

.severity-badge--low {
  --severity-color: #66b5f6;
}

.severity-badge--info,
.severity-badge--unknown {
  --severity-color: #8f979d;
}

.severity-badge--compact {
  gap: 5px;
  font-size: 11px;
}

.severity-badge--compact .severity-badge__dot {
  width: 6px;
  height: 6px;
}
</style>
