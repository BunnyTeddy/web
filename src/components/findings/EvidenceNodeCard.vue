<script setup lang="ts">
import { computed } from 'vue'
import { Check, CircleHelp } from '@lucide/vue'
import { Handle, Position } from '@vue-flow/core'

interface EvidenceNodeData {
  index: number
  file: string
  line: number | null
  role: string
  verified: boolean
  level: 'verified' | 'inferred' | 'usage'
  selected: boolean
  active: boolean
  visited: boolean
}

const props = defineProps<{
  data: EvidenceNodeData
}>()

defineEmits<{
  select: []
}>()

const fileName = computed(() => {
  const parts = props.data.file.split(/[\\/]/).filter(Boolean)
  return parts.at(-1) || props.data.file || 'Unknown file'
})

const directory = computed(() => {
  const lastSeparator = Math.max(
    props.data.file.lastIndexOf('/'),
    props.data.file.lastIndexOf('\\'),
  )
  return lastSeparator > -1 ? props.data.file.slice(0, lastSeparator) : ''
})

const roleClass = computed(() =>
  (props.data.role || 'evidence').toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
)
</script>

<template>
  <article
    class="evidence-node"
    :class="[
      `evidence-node--${roleClass}`,
      `evidence-node--${data.level}`,
      {
        'evidence-node--selected': data.selected,
        'evidence-node--active': data.active,
        'evidence-node--visited': data.visited,
      },
    ]"
    role="button"
    tabindex="0"
    :aria-label="`Step ${data.index}, ${data.role}, ${data.file}${data.line !== null ? ` line ${data.line}` : ''}`"
    :aria-current="data.selected ? 'step' : undefined"
    @click="$emit('select')"
    @keydown.enter.prevent="$emit('select')"
    @keydown.space.prevent="$emit('select')"
  >
    <Handle type="target" :position="Position.Left" class="evidence-handle evidence-handle--target" />

    <div class="evidence-node__topline">
      <span class="evidence-node__index mono">STEP {{ String(data.index).padStart(2, '0') }}</span>
      <span
        class="evidence-node__verification"
        :class="{ 'evidence-node__verification--verified': data.verified }"
        :title="data.verified ? 'Verified against the scanned source' : 'Not independently verified'"
      >
        <Check v-if="data.verified" :size="12" :stroke-width="2.5" />
        <CircleHelp v-else :size="12" />
      </span>
    </div>

    <div class="evidence-node__role">
      <i aria-hidden="true" />
      {{ data.role }}
    </div>

    <div class="evidence-node__location mono" :title="data.file">
      <span>{{ fileName }}</span>
      <span v-if="data.line !== null" class="evidence-node__line">:{{ data.line }}</span>
    </div>
    <div v-if="directory" class="evidence-node__directory mono" :title="directory">
      {{ directory }}
    </div>
    <div v-else class="evidence-node__directory mono">Project root</div>

    <span class="evidence-node__level">
      {{ data.level === 'usage' ? 'usage-only' : data.level }}
    </span>

    <Handle type="source" :position="Position.Right" class="evidence-handle evidence-handle--source" />
  </article>
</template>

<style scoped>
.evidence-node {
  --role-color: #8f979d;
  position: relative;
  box-sizing: border-box;
  width: 180px;
  min-height: 120px;
  padding: 13px 14px 12px;
  border: 1px solid #30393e;
  border-top: 2px solid var(--role-color);
  border-radius: 7px;
  outline: none;
  color: #eef0ec;
  background: #13191c;
  box-shadow: 0 8px 20px rgb(0 0 0 / 18%);
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.evidence-node:hover {
  border-color: #536067;
  border-top-color: var(--role-color);
  background: #151c1f;
}

.evidence-node:focus-visible {
  outline: 2px solid #b7e96d;
  outline-offset: 3px;
}

.evidence-node--entrypoint {
  --role-color: #66b5f6;
}

.evidence-node--caller {
  --role-color: #9aa9ff;
}

.evidence-node--introducer {
  --role-color: #e7b84b;
}

.evidence-node--import {
  --role-color: #75c99b;
}

.evidence-node--symbol {
  --role-color: #71b9c2;
}

.evidence-node--sink {
  --role-color: #ff766d;
}

.evidence-node--usage {
  border-style: dotted;
  border-top-style: solid;
}

.evidence-node--selected {
  border-color: #77866a;
  border-top-color: var(--role-color);
  box-shadow: 0 0 0 2px rgb(169 223 89 / 12%), 0 10px 26px rgb(0 0 0 / 25%);
}

.evidence-node--active {
  border-color: #a9df59;
  border-top-color: #c3ef7f;
  box-shadow: 0 0 0 3px rgb(169 223 89 / 12%), 0 12px 28px rgb(0 0 0 / 30%);
  animation: trace-node-arrive 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.evidence-node--visited .evidence-node__index {
  color: #9cbc6c;
}

.evidence-node__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 9px;
}

.evidence-node__index {
  color: #6f797f;
  font-size: 8.5px;
  font-weight: 680;
  letter-spacing: 0.08em;
}

.evidence-node__verification {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid #353e43;
  border-radius: 50%;
  color: #737d83;
}

.evidence-node__verification--verified {
  border-color: rgb(111 196 151 / 34%);
  color: #78cba1;
  background: rgb(111 196 151 / 7%);
}

.evidence-node__role {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
  color: var(--role-color);
  font-size: 11px;
  font-weight: 690;
  text-transform: capitalize;
}

.evidence-node__role i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.evidence-node__location {
  display: flex;
  overflow: hidden;
  color: #eef0ec;
  font-size: 11.5px;
  font-weight: 650;
  white-space: nowrap;
}

.evidence-node__location span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
}

.evidence-node__line {
  flex: 0 0 auto;
  color: #8cb8dc;
}

.evidence-node__directory {
  overflow: hidden;
  margin-top: 4px;
  color: #667178;
  font-size: 8.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evidence-node__level {
  display: inline-block;
  margin-top: 8px;
  color: #6e787e;
  font-size: 8px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.evidence-handle {
  width: 8px;
  height: 8px;
  border: 2px solid #0c1012;
  background: var(--role-color);
}

.evidence-handle--target {
  left: -5px;
}

.evidence-handle--source {
  right: -5px;
}

@keyframes trace-node-arrive {
  0% {
    transform: scale(0.985);
  }
  55% {
    transform: scale(1.025);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .evidence-node {
    transition: none;
  }

  .evidence-node--active {
    animation: none;
  }
}
</style>
