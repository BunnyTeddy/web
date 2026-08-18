<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/controls/dist/style.css'
import {
  MarkerType,
  VueFlow,
  type Edge,
  type Node,
  type VueFlowStore,
} from '@vue-flow/core'
import {
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  Pause,
  Play,
} from '@lucide/vue'

import EvidenceNodeCard from './EvidenceNodeCard.vue'
import {
  evidenceLevelForEdge,
  evidenceLevelForStep,
  type EvidenceLevel,
  type EvidenceStep,
} from './evidenceGraphModel'

const props = withDefaults(
  defineProps<{
    steps?: EvidenceStep[]
    usageOnly?: boolean
    reachability?: string | null
  }>(),
  {
    steps: () => [],
    usageOnly: false,
    reachability: null,
  },
)

const selectedIndex = ref(0)
const activeIndex = ref(-1)
const visitedThrough = ref(-1)
const isPlaying = ref(false)
const hasPlayed = ref(false)
const playRun = ref(0)
const actionFeedback = ref('')
const flowInstance = ref<VueFlowStore | null>(null)

let traceTimer: number | undefined
let feedbackTimer: number | undefined

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

const verifiedCount = computed(() => props.steps.filter((step) => step.verified).length)
const reachabilityLabel = computed(() => props.reachability || 'unavailable / unknown')
const selectedStep = computed(() => props.steps[selectedIndex.value] ?? null)
const selectedLevel = computed(() =>
  selectedStep.value
    ? evidenceLevelForStep(selectedStep.value, props.usageOnly)
    : 'inferred',
)
const sourceLocation = computed(() => {
  const step = selectedStep.value
  if (!step) return ''

  const lineStart = step.line ?? null
  const lineEnd = step.lineEnd ?? null
  if (lineStart === null) return step.file || 'Unknown file'
  if (lineEnd !== null && lineEnd !== lineStart) return `${step.file}:${lineStart}-${lineEnd}`
  return `${step.file}:${lineStart}`
})
const playLabel = computed(() => {
  if (isPlaying.value) return 'Stop evidence'
  return hasPlayed.value ? 'Replay evidence' : 'Play evidence'
})

const nodes = computed<Node[]>(() =>
  props.steps.map((step, index) => ({
    id: `evidence-${index}`,
    type: 'evidence',
    position: { x: 44 + index * 208, y: 58 },
    draggable: false,
    selectable: true,
    data: {
      index: index + 1,
      file: step.file,
      line: step.line ?? null,
      role: (step.role || 'evidence').toLowerCase(),
      verified: Boolean(step.verified),
      level: evidenceLevelForStep(step, props.usageOnly),
      selected: selectedIndex.value === index,
      active: activeIndex.value === index,
      visited: visitedThrough.value >= index,
    },
  })),
)

const edgeColor = (level: EvidenceLevel, completed: boolean) => {
  if (completed) return '#819d55'
  if (level === 'usage') return '#66727a'
  if (level === 'inferred') return '#74747f'
  return '#6f7b75'
}

const edges = computed<Edge[]>(() => {
  const baseEdges: Edge[] = props.steps.slice(0, -1).map((step, index) => {
    const target = props.steps[index + 1] ?? step
    const level = evidenceLevelForEdge(step, target, props.usageOnly)
    const completed = visitedThrough.value > index
    const color = edgeColor(level, completed)

    return {
      id: `edge-${index}`,
      source: `evidence-${index}`,
      target: `evidence-${index + 1}`,
      type: 'smoothstep',
      selectable: false,
      markerEnd: { type: MarkerType.ArrowClosed, color },
      class: `trace-edge trace-edge--${level}${completed ? ' trace-edge--completed' : ''}`,
      style: {
        stroke: color,
        strokeWidth: completed ? 1.8 : 1.45,
        strokeDasharray: level === 'inferred' ? '8 6' : level === 'usage' ? '2 7' : undefined,
      },
    }
  })

  const activeEdgeIndex = isPlaying.value ? activeIndex.value : -1
  if (activeEdgeIndex >= 0 && activeEdgeIndex < props.steps.length - 1) {
    baseEdges.push({
      id: `pulse-${playRun.value}-${activeEdgeIndex}`,
      source: `evidence-${activeEdgeIndex}`,
      target: `evidence-${activeEdgeIndex + 1}`,
      type: 'smoothstep',
      selectable: false,
      class: 'trace-edge trace-edge--pulse',
      style: {
        stroke: '#b7ef58',
        strokeWidth: 3,
        strokeDasharray: '16 900',
      },
    })
  }

  return baseEdges
})

function clearTraceTimer() {
  if (traceTimer !== undefined) window.clearTimeout(traceTimer)
  traceTimer = undefined
}

function stopTrace() {
  clearTraceTimer()
  isPlaying.value = false
  activeIndex.value = -1
}

function handleFlowInit(instance: VueFlowStore) {
  flowInstance.value = instance
}

function focusPlaybackStep(index: number) {
  if (props.steps.length <= 4 || !flowInstance.value) return

  const nodeCenterX = 44 + index * 208 + 90
  const nodeCenterY = 58 + 60
  void flowInstance.value.setCenter(nodeCenterX, nodeCenterY, {
    zoom: 0.9,
    duration: prefersReducedMotion() ? 0 : 360,
    interpolate: 'smooth',
  })
}

function playStep(index: number) {
  if (index >= props.steps.length) {
    stopTrace()
    hasPlayed.value = true
    return
  }

  activeIndex.value = index
  selectedIndex.value = index
  visitedThrough.value = index
  focusPlaybackStep(index)
  traceTimer = window.setTimeout(
    () => playStep(index + 1),
    index === props.steps.length - 1 ? 900 : 720,
  )
}

function playEvidence() {
  if (!props.steps.length) return
  if (isPlaying.value) {
    stopTrace()
    return
  }

  clearTraceTimer()
  playRun.value += 1
  actionFeedback.value = ''
  visitedThrough.value = -1
  hasPlayed.value = false

  if (prefersReducedMotion()) {
    selectedIndex.value = props.steps.length - 1
    visitedThrough.value = props.steps.length - 1
    hasPlayed.value = true
    focusPlaybackStep(props.steps.length - 1)
    return
  }

  isPlaying.value = true
  playStep(0)
}

function selectNode(index: number) {
  stopTrace()
  selectedIndex.value = index
  actionFeedback.value = ''
}

function setActionFeedback(value: string) {
  if (feedbackTimer !== undefined) window.clearTimeout(feedbackTimer)
  actionFeedback.value = value
  feedbackTimer = window.setTimeout(() => {
    actionFeedback.value = ''
  }, 2800)
}

async function copySourceLocation(showFeedback = true): Promise<boolean> {
  if (!sourceLocation.value || !navigator.clipboard?.writeText) {
    if (showFeedback) setActionFeedback('Clipboard access is unavailable in this browser.')
    return false
  }

  try {
    await navigator.clipboard.writeText(sourceLocation.value)
    if (showFeedback) setActionFeedback('Source location copied.')
    return true
  } catch {
    if (showFeedback) setActionFeedback('Clipboard access is unavailable in this browser.')
    return false
  }
}

async function openSource() {
  const step = selectedStep.value
  if (!step || typeof window === 'undefined') return

  const event = new CustomEvent('secsource:open-source', {
    cancelable: true,
    detail: {
      file: step.file,
      line: step.line ?? null,
      lineEnd: step.lineEnd ?? null,
    },
  })
  const handledByHost = !window.dispatchEvent(event)
  if (handledByHost) {
    setActionFeedback('Open source request sent.')
    return
  }

  const copied = await copySourceLocation(false)
  setActionFeedback(
    copied
      ? 'Editor integration is not connected. Source location copied.'
      : 'Editor integration is not connected.',
  )
}

watch(
  () => props.steps,
  () => {
    stopTrace()
    selectedIndex.value = 0
    visitedThrough.value = -1
    hasPlayed.value = false
    actionFeedback.value = ''
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearTraceTimer()
  if (feedbackTimer !== undefined) window.clearTimeout(feedbackTimer)
})
</script>

<template>
  <section class="graph-shell" aria-label="Evidence chain graph">
    <header class="graph-shell__header">
      <div class="graph-shell__intro">
        <div class="graph-shell__title">
          <GitBranch :size="16" />
          {{ usageOnly ? 'Usage evidence' : 'Investigation trace' }}
        </div>
        <p>
          {{
            usageOnly
              ? 'Usage evidence only — this does not confirm a source-to-sink call path.'
              : 'Ordered investigation evidence; not a confirmed runtime call graph.'
          }}
        </p>
      </div>

      <div v-if="steps.length" class="graph-shell__toolbar">
        <div class="trace-summary" aria-label="Evidence summary">
          <strong>{{ steps.length }}</strong> {{ steps.length === 1 ? 'step' : 'steps' }}
          <span aria-hidden="true">·</span>
          <strong>{{ verifiedCount }}</strong> verified nodes
          <span aria-hidden="true">·</span>
          <span class="trace-summary__reachability">Reachability {{ reachabilityLabel }}</span>
        </div>
        <button
          type="button"
          class="play-button"
          :class="{ 'play-button--playing': isPlaying }"
          :aria-label="playLabel"
          @click="playEvidence"
        >
          <Pause v-if="isPlaying" :size="14" fill="currentColor" />
          <Play v-else :size="14" fill="currentColor" />
          {{ playLabel }}
        </button>
      </div>
    </header>

    <div v-if="nodes.length" class="graph-shell__legend" aria-label="Evidence legend">
      <span><i class="legend-line legend-line--verified" /> Verified-node sequence</span>
      <span><i class="legend-line legend-line--inferred" /> Includes unverified evidence</span>
      <span><i class="legend-line legend-line--usage" /> Usage adjacency</span>
      <span class="graph-shell__pan-hint">Drag canvas to pan · scroll to zoom</span>
    </div>

    <div v-if="nodes.length" class="graph-shell__canvas">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :elements-selectable="true"
        :min-zoom="0.52"
        :max-zoom="1.45"
        :default-viewport="{ x: 36, y: 24, zoom: 0.86 }"
        :fit-view-on-init="nodes.length <= 4"
        :fit-view-on-init-options="{ padding: 0.08, maxZoom: 1 }"
        @init="handleFlowInit"
      >
        <Background pattern-color="#252d32" :gap="22" :size="1" />
        <Controls position="bottom-right" />
        <template #node-evidence="nodeProps">
          <EvidenceNodeCard
            :data="nodeProps.data"
            @select="selectNode(nodeProps.data.index - 1)"
          />
        </template>
      </VueFlow>
    </div>

    <aside v-if="selectedStep" class="evidence-inspector" aria-label="Selected evidence step">
      <div class="evidence-inspector__identity">
        <span class="evidence-inspector__eyebrow mono">
          Step {{ String(selectedIndex + 1).padStart(2, '0') }}
        </span>
        <div>
          <strong>{{ selectedStep.role || 'Evidence' }}</strong>
          <span class="evidence-level" :class="`evidence-level--${selectedLevel}`">
            <Check v-if="selectedLevel === 'verified'" :size="11" />
            {{ selectedLevel === 'usage' ? 'usage-only' : selectedLevel }}
          </span>
        </div>
      </div>

      <section class="evidence-inspector__reason">
        <span class="inspector-label">Why it matters</span>
        <p :class="{ muted: !selectedStep.note }">
          {{ selectedStep.note || 'No investigation note was provided for this step.' }}
        </p>
      </section>

      <section class="evidence-inspector__source">
        <span class="inspector-label">Source location</span>
        <code>{{ sourceLocation }}</code>
        <small v-if="selectedStep.line == null">Exact line unavailable</small>
      </section>

      <div class="evidence-inspector__actions">
        <button type="button" @click="openSource">
          <ExternalLink :size="13" />
          Open source
        </button>
        <button type="button" @click="copySourceLocation()">
          <Copy :size="13" />
          Copy path
        </button>
        <span v-if="actionFeedback" class="action-feedback" role="status">
          {{ actionFeedback }}
        </span>
      </div>
    </aside>

    <div v-else class="graph-shell__empty">
      <GitBranch :size="24" />
      <strong>No evidence path was reported</strong>
      <span>The scanner did not return evidence-chain or usage-site data for this finding.</span>
    </div>
  </section>
</template>

<style scoped>
.graph-shell {
  display: flex;
  overflow: hidden;
  min-height: 520px;
  height: 100%;
  flex-direction: column;
  border: 1px solid #283036;
  border-radius: 8px;
  background: #0d1114;
  container-type: inline-size;
}

.graph-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 16px 13px;
  border-bottom: 1px solid #283036;
  background: #101518;
}

.graph-shell__intro {
  min-width: 0;
}

.graph-shell__title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #eef0ec;
  font-size: 14px;
  font-weight: 680;
}

.graph-shell__header p {
  max-width: 570px;
  margin: 4px 0 0;
  color: #818b90;
  font-size: 11px;
  line-height: 1.4;
}

.graph-shell__toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
}

.trace-summary {
  color: #7f898f;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 10.5px;
  white-space: nowrap;
}

.trace-summary strong {
  color: #cbd1cc;
  font-weight: 650;
}

.trace-summary__reachability {
  color: #c4a86c;
}

.play-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 112px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #95c94d;
  border-radius: 6px;
  color: #11160c;
  background: #a9df59;
  font: inherit;
  font-size: 11px;
  font-weight: 720;
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease, transform 150ms ease;
}

.play-button:hover {
  border-color: #b8ed6b;
  background: #b4e968;
}

.play-button:active {
  transform: translateY(1px);
}

.play-button:focus-visible {
  outline: 2px solid #c7f583;
  outline-offset: 2px;
}

.play-button--playing {
  border-color: #4c585e;
  color: #d9ded9;
  background: #20272b;
}

.graph-shell__legend {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 31px;
  padding: 0 16px;
  border-bottom: 1px solid #222a2f;
  color: #747f84;
  background: #0c1012;
  font-size: 9.5px;
}

.graph-shell__legend > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.legend-line {
  display: inline-block;
  width: 20px;
  height: 1px;
  background: #737f78;
}

.legend-line--inferred {
  height: 0;
  border-top: 1px dashed #74747f;
  background: transparent;
}

.legend-line--usage {
  height: 0;
  border-top: 1px dotted #68737a;
  background: transparent;
}

.graph-shell__pan-hint {
  margin-left: auto;
}

.graph-shell__canvas {
  min-height: 245px;
  flex: 1 1 auto;
  background: #0d1114;
}

.evidence-inspector {
  display: grid;
  position: relative;
  z-index: 2;
  grid-template-columns: minmax(132px, 0.7fr) minmax(220px, 1.45fr) minmax(190px, 1fr) auto;
  align-items: center;
  gap: 22px;
  min-height: 112px;
  padding: 15px 17px;
  border-top: 1px solid #303a3f;
  background: #121719;
  box-shadow: 0 -12px 30px rgb(0 0 0 / 14%);
}

.evidence-inspector__identity {
  min-width: 0;
}

.evidence-inspector__eyebrow,
.inspector-label {
  display: block;
  margin-bottom: 7px;
  color: #707b81;
  font-size: 9px;
  font-weight: 680;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.evidence-inspector__identity > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.evidence-inspector__identity strong {
  overflow: hidden;
  color: #e9ece7;
  font-size: 13px;
  font-weight: 680;
  text-overflow: ellipsis;
  text-transform: capitalize;
  white-space: nowrap;
}

.evidence-level {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 6px;
  border: 1px solid #3b4449;
  border-radius: 999px;
  color: #8d979b;
  font-size: 8.5px;
  font-weight: 680;
  line-height: 1;
  text-transform: uppercase;
}

.evidence-level--verified {
  border-color: rgb(117 201 155 / 32%);
  color: #7bcaa0;
  background: rgb(117 201 155 / 6%);
}

.evidence-level--usage {
  border-style: dotted;
  color: #9ba4a8;
}

.evidence-inspector__reason,
.evidence-inspector__source {
  min-width: 0;
}

.evidence-inspector__reason p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: #b6bdb9;
  font-size: 11px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.evidence-inspector__reason p.muted {
  color: #6f797e;
}

.evidence-inspector__source code {
  display: block;
  overflow: hidden;
  color: #d5dad5;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evidence-inspector__source small {
  display: block;
  margin-top: 5px;
  color: #6e797e;
  font-size: 9.5px;
}

.evidence-inspector__actions {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}

.evidence-inspector__actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 29px;
  padding: 0 9px;
  border: 1px solid #343d42;
  border-radius: 5px;
  color: #b9c0bc;
  background: #171d20;
  font: inherit;
  font-size: 9.5px;
  font-weight: 620;
  white-space: nowrap;
  cursor: pointer;
}

.evidence-inspector__actions button:hover {
  border-color: #536067;
  color: #eef1ed;
  background: #1d2428;
}

.evidence-inspector__actions button:focus-visible {
  outline: 2px solid #a9df59;
  outline-offset: 2px;
}

.action-feedback {
  position: absolute;
  right: 0;
  bottom: -19px;
  color: #89958e;
  font-size: 8.5px;
  white-space: nowrap;
}

.graph-shell__empty {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 30px;
  color: #6f797f;
  text-align: center;
}

.graph-shell__empty strong {
  color: #cbd0ca;
  font-size: 13px;
}

.graph-shell__empty span {
  max-width: 410px;
  font-size: 12px;
  line-height: 1.5;
}

:deep(.vue-flow__edge) {
  pointer-events: none;
}

:deep(.trace-edge .vue-flow__edge-path) {
  transition: stroke 180ms ease, stroke-width 180ms ease;
}

:deep(.trace-edge--pulse .vue-flow__edge-path) {
  filter: drop-shadow(0 0 3px rgb(183 239 88 / 52%));
  animation: trace-edge-pulse 700ms cubic-bezier(0.3, 0, 0.6, 1) both;
}

:deep(.vue-flow__controls) {
  overflow: hidden;
  border: 1px solid #323a40;
  border-radius: 6px;
  box-shadow: none;
}

:deep(.vue-flow__controls-button) {
  border-bottom: 1px solid #323a40;
  color: #c6ccc7;
  background: #151a1e;
  fill: currentColor;
}

:deep(.vue-flow__controls-button:hover) {
  background: #20272c;
}

@keyframes trace-edge-pulse {
  from {
    stroke-dashoffset: 170;
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  82% {
    opacity: 1;
  }
  to {
    stroke-dashoffset: -110;
    opacity: 0;
  }
}

@container (max-width: 840px) {
  .graph-shell__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .graph-shell__toolbar {
    width: 100%;
    justify-content: space-between;
  }

  .evidence-inspector {
    grid-template-columns: minmax(120px, 0.65fr) minmax(210px, 1.35fr) minmax(160px, 1fr);
  }

  .evidence-inspector__actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .action-feedback {
    position: static;
  }
}

@container (max-width: 590px) {
  .graph-shell__legend {
    overflow-x: auto;
  }

  .graph-shell__pan-hint {
    display: none;
  }

  .evidence-inspector {
    grid-template-columns: 1fr;
    gap: 13px;
  }

  .evidence-inspector__actions {
    grid-column: auto;
    flex-wrap: wrap;
  }

  .action-feedback {
    flex-basis: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .play-button,
  :deep(.trace-edge .vue-flow__edge-path) {
    transition: none;
  }

  :deep(.trace-edge--pulse .vue-flow__edge-path) {
    animation: none;
    filter: none;
  }
}
</style>
