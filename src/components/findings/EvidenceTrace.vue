<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Copy,
  FileCode2,
  GitBranch,
} from '@lucide/vue'

import type {
  EvidenceKind,
  EvidenceNode,
  ReachabilityStatus,
} from '@/domain/types'
import {
  evidenceLevelForNode,
  evidenceLevelLabel,
  evidenceSourceLabel,
  formatEvidenceLocation,
} from './evidenceTraceModel'

const props = withDefaults(
  defineProps<{
    steps?: EvidenceNode[]
    kind?: EvidenceKind
    reachability?: ReachabilityStatus
  }>(),
  {
    steps: () => [],
    kind: 'unavailable',
    reachability: 'unavailable',
  },
)

const selectedIndex = ref(0)
const actionFeedback = ref('')
const stepButtons = ref<Array<HTMLButtonElement | null>>([])

const selectedStep = computed(() => props.steps[selectedIndex.value] ?? null)
const selectedLevel = computed(() =>
  selectedStep.value
    ? evidenceLevelForNode(selectedStep.value, props.kind)
    : 'inferred',
)
const selectedLocation = computed(() =>
  selectedStep.value ? formatEvidenceLocation(selectedStep.value) : '',
)
const verifiedCount = computed(
  () => props.steps.filter((step) => evidenceLevelForNode(step, props.kind) === 'verified').length,
)
const isUsageOnly = computed(() => props.kind === 'usage')
const traceKindLabel = computed(() =>
  isUsageOnly.value ? 'Usage only' : 'Investigation',
)
const disclaimer = computed(() =>
  isUsageOnly.value
    ? 'Usage evidence only — these locations do not confirm a source-to-sink call path.'
    : 'Ordered investigation evidence; not a confirmed runtime call graph.',
)

function setStepButton(
  element: Element | ComponentPublicInstance | null,
  index: number,
) {
  stepButtons.value[index] = element instanceof HTMLButtonElement ? element : null
}

function selectStep(index: number, moveFocus = false) {
  if (index < 0 || index >= props.steps.length) return
  selectedIndex.value = index
  actionFeedback.value = ''
  if (moveFocus) void nextTick(() => stepButtons.value[index]?.focus())
}

function handleStepKeydown(event: KeyboardEvent, index: number) {
  let target: number | null = null
  if (event.key === 'ArrowUp') target = Math.max(0, index - 1)
  else if (event.key === 'ArrowDown') target = Math.min(props.steps.length - 1, index + 1)
  else if (event.key === 'Home') target = 0
  else if (event.key === 'End') target = props.steps.length - 1

  if (target === null) return
  event.preventDefault()
  selectStep(target, true)
}

async function copyLocation() {
  if (!selectedLocation.value || !navigator.clipboard?.writeText) {
    actionFeedback.value = 'Clipboard access is unavailable in this browser.'
    return
  }

  try {
    await navigator.clipboard.writeText(selectedLocation.value)
    actionFeedback.value = 'Source location copied.'
  } catch {
    actionFeedback.value = 'Clipboard access is unavailable in this browser.'
  }
}

watch(
  () => props.steps.map((step) => step.id).join('|'),
  () => {
    selectedIndex.value = 0
    actionFeedback.value = ''
    stepButtons.value = []
  },
  { immediate: true },
)
</script>

<template>
  <section
    class="evidence-trace"
    :class="{ 'evidence-trace--usage': isUsageOnly }"
    aria-label="Evidence trace"
  >
    <header class="evidence-trace__header">
      <div class="evidence-trace__intro">
        <div class="evidence-trace__title">
          <GitBranch :size="16" />
          <h3>Evidence trace</h3>
          <span>{{ traceKindLabel }}</span>
        </div>
        <p>{{ disclaimer }}</p>
      </div>

      <div v-if="steps.length" class="evidence-trace__summary" aria-label="Evidence summary">
        <span><strong>{{ steps.length }}</strong> evidence {{ steps.length === 1 ? 'point' : 'points' }}</span>
        <span aria-hidden="true">·</span>
        <span><strong>{{ verifiedCount }}</strong> verified</span>
        <span class="evidence-trace__reachability">
          Reachability <strong>{{ reachability }}</strong>
        </span>
      </div>
    </header>

    <div v-if="steps.length" class="evidence-trace__layout">
      <div class="evidence-trace__sequence">
        <div class="evidence-trace__sequence-heading">
          <div>
            <span class="trace-label">Reported order</span>
            <strong>Evidence points</strong>
          </div>
          <small>Use arrow keys to move between steps</small>
        </div>

        <ol class="evidence-list" aria-label="Ordered evidence points">
          <li v-for="(step, index) in steps" :key="step.id" class="evidence-list__item">
            <span class="evidence-list__rail" aria-hidden="true" />
            <button
              :ref="(element) => setStepButton(element, index)"
              type="button"
              class="evidence-step"
              :class="{
                'evidence-step--selected': index === selectedIndex,
                'evidence-step--usage': evidenceLevelForNode(step, kind) === 'usage',
              }"
              :aria-current="index === selectedIndex ? 'step' : undefined"
              :aria-label="`Step ${index + 1} of ${steps.length}, ${step.role || 'evidence'}, ${formatEvidenceLocation(step)}, ${evidenceLevelLabel(evidenceLevelForNode(step, kind))}`"
              @click="selectStep(index)"
              @keydown="handleStepKeydown($event, index)"
            >
              <span class="evidence-step__marker mono" aria-hidden="true">
                {{ String(index + 1).padStart(2, '0') }}
              </span>

              <span class="evidence-step__body">
                <span class="evidence-step__topline">
                  <span class="evidence-step__role">{{ step.role || 'Evidence' }}</span>
                  <span
                    class="evidence-level"
                    :class="`evidence-level--${evidenceLevelForNode(step, kind)}`"
                  >
                    <Check
                      v-if="evidenceLevelForNode(step, kind) === 'verified'"
                      :size="11"
                      aria-hidden="true"
                    />
                    <CircleHelp v-else :size="11" aria-hidden="true" />
                    {{ evidenceLevelLabel(evidenceLevelForNode(step, kind)) }}
                  </span>
                </span>

                <code class="evidence-step__location">{{ formatEvidenceLocation(step) }}</code>
                <span class="evidence-step__note">
                  {{ step.note || 'No investigation note was provided for this step.' }}
                </span>
                <span class="evidence-step__source">
                  Evidence source: {{ evidenceSourceLabel(step) }}
                </span>
              </span>
            </button>
          </li>
        </ol>
      </div>

      <aside v-if="selectedStep" class="evidence-inspector" aria-label="Selected evidence step">
        <header class="evidence-inspector__header">
          <div>
            <span class="trace-label mono">
              Step {{ String(selectedIndex + 1).padStart(2, '0') }} of
              {{ String(steps.length).padStart(2, '0') }}
            </span>
            <h4>{{ selectedStep.role || 'Evidence' }}</h4>
          </div>
          <span class="evidence-level" :class="`evidence-level--${selectedLevel}`">
            <Check v-if="selectedLevel === 'verified'" :size="11" aria-hidden="true" />
            <CircleHelp v-else :size="11" aria-hidden="true" />
            {{ evidenceLevelLabel(selectedLevel) }}
          </span>
        </header>

        <section class="evidence-inspector__section">
          <span class="trace-label">Why it matters</span>
          <p :class="{ muted: !selectedStep.note }">
            {{ selectedStep.note || 'No investigation note was provided for this step.' }}
          </p>
        </section>

        <section class="evidence-inspector__section">
          <span class="trace-label">Source location</span>
          <div class="evidence-inspector__location">
            <FileCode2 :size="14" aria-hidden="true" />
            <code>{{ selectedLocation }}</code>
          </div>
          <small v-if="selectedStep.line === null">Exact line unavailable</small>
        </section>

        <section class="evidence-inspector__section evidence-inspector__facts">
          <div>
            <span class="trace-label">Evidence source</span>
            <strong>{{ evidenceSourceLabel(selectedStep) }}</strong>
          </div>
          <div>
            <span class="trace-label">Verification</span>
            <strong>{{ evidenceLevelLabel(selectedLevel) }}</strong>
          </div>
        </section>

        <section class="evidence-inspector__section">
          <span class="trace-label">Source evidence</span>
          <pre v-if="selectedStep.snippet" class="evidence-snippet"><code>{{ selectedStep.snippet }}</code></pre>
          <div v-else class="evidence-snippet evidence-snippet--empty mono">
            Source snippet unavailable
          </div>
        </section>

        <div class="evidence-inspector__actions">
          <button type="button" class="trace-button" @click="copyLocation">
            <Copy :size="13" aria-hidden="true" />
            Copy location
          </button>
          <div class="evidence-inspector__navigation" aria-label="Evidence navigation">
            <button
              type="button"
              class="trace-button trace-button--nav"
              :disabled="selectedIndex === 0"
              aria-label="Previous evidence"
              @click="selectStep(selectedIndex - 1, true)"
            >
              <ChevronUp :size="15" aria-hidden="true" />
              Previous
            </button>
            <button
              type="button"
              class="trace-button trace-button--nav trace-button--next"
              :disabled="selectedIndex === steps.length - 1"
              aria-label="Next evidence"
              @click="selectStep(selectedIndex + 1, true)"
            >
              Next evidence
              <ChevronDown :size="15" aria-hidden="true" />
            </button>
          </div>
        </div>
        <p class="evidence-inspector__feedback" role="status" aria-live="polite">
          {{ actionFeedback }}
        </p>
      </aside>
    </div>

    <div v-else class="evidence-trace__empty">
      <GitBranch :size="24" aria-hidden="true" />
      <strong>No evidence was reported</strong>
      <span>The scanner did not return investigation evidence or usage locations for this finding.</span>
    </div>

  </section>
</template>

<style scoped>
.evidence-trace {
  overflow: clip;
  border: 1px solid #283036;
  border-radius: var(--radius-panel);
  background: #0d1114;
  container-type: inline-size;
}

.evidence-trace__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 72px;
  padding: 13px 18px;
  border-bottom: 1px solid #283036;
  background: #101518;
}

.evidence-trace__intro {
  min-width: 0;
}

.evidence-trace__title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #edf0eb;
}

.evidence-trace__title h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 680;
}

.evidence-trace__title > span {
  padding: 3px 6px;
  border: 1px solid #384147;
  border-radius: var(--radius-compact);
  color: #8f999e;
  background: #151a1d;
  font-size: 8.5px;
  font-weight: 680;
  letter-spacing: 0.05em;
  line-height: 1;
  text-transform: uppercase;
}

.evidence-trace__intro p {
  margin: 5px 0 0;
  color: #818b90;
  font-size: 11px;
  line-height: 1.45;
}

.evidence-trace__summary {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  color: #818b90;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 10.5px;
  white-space: nowrap;
}

.evidence-trace__summary strong {
  color: #ccd2cc;
  font-weight: 650;
}

.evidence-trace__reachability {
  margin-left: 6px;
  padding: 5px 8px;
  border: 1px solid rgb(213 175 98 / 32%);
  border-radius: var(--radius-compact);
  background: rgb(213 175 98 / 5%);
  text-transform: capitalize;
}

.evidence-trace__reachability strong {
  color: #d5af62;
}

.evidence-trace__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.75fr) minmax(280px, 1fr);
  align-items: start;
}

.evidence-trace__sequence {
  min-width: 0;
  padding: 16px 18px 18px;
  border-right: 1px solid #283036;
}

.evidence-trace__sequence-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 0 0 10px 44px;
}

.evidence-trace__sequence-heading > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.evidence-trace__sequence-heading strong {
  color: #d4d9d4;
  font-size: 12px;
  font-weight: 650;
}

.evidence-trace__sequence-heading small {
  color: #69747a;
  font-size: 9.5px;
}

.trace-label {
  color: #778187;
  font-size: 9px;
  font-weight: 680;
  letter-spacing: 0.075em;
  text-transform: uppercase;
}

.evidence-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.evidence-list__item {
  display: grid;
  position: relative;
  grid-template-columns: 44px minmax(0, 1fr);
  min-width: 0;
}

.evidence-list__item:not(:last-child) {
  padding-bottom: 8px;
}

.evidence-list__rail {
  position: absolute;
  top: 29px;
  bottom: -13px;
  left: 15px;
  width: 1px;
  background: #354047;
}

.evidence-list__item:last-child .evidence-list__rail {
  display: none;
}

.evidence-trace--usage .evidence-list__rail {
  width: 0;
  border-left: 1px dotted #556168;
  background: none;
}

.evidence-step {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: 44px minmax(0, 1fr);
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-panel);
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.evidence-step__marker {
  display: inline-flex;
  z-index: 1;
  align-items: center;
  justify-content: center;
  width: 31px;
  height: 31px;
  border: 1px solid #3a444a;
  border-radius: var(--radius-compact);
  color: #929ca1;
  background: #12181b;
  font-size: 9px;
  font-weight: 700;
}

.evidence-step__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  padding: 10px 13px 9px;
  border: 1px solid #2b3439;
  border-left: 2px solid #424c51;
  border-radius: var(--radius-panel);
  background: #11171a;
  transition: border-color 140ms ease, background 140ms ease;
}

.evidence-step:hover .evidence-step__body {
  border-color: #4a565c;
  background: #141b1e;
}

.evidence-step:focus-visible {
  outline: none;
}

.evidence-step:focus-visible .evidence-step__body,
.evidence-step:focus-visible .evidence-step__marker {
  outline: 2px solid #b7ef45;
  outline-offset: 2px;
}

.evidence-step--selected .evidence-step__body {
  border-color: #56634e;
  border-left-color: #b7ef45;
  background: #151c18;
}

.evidence-step--selected .evidence-step__marker {
  border-color: #7da745;
  color: #d8f5ad;
  background: #192116;
}

.evidence-step--usage .evidence-step__body {
  border-top-style: dotted;
  border-right-style: dotted;
  border-bottom-style: dotted;
}

.evidence-step__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.evidence-step__role {
  color: #d9ddd8;
  font-size: 12px;
  font-weight: 680;
  text-transform: capitalize;
}

.evidence-level {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border: 1px solid #3b4449;
  border-radius: var(--radius-compact);
  color: #939ca0;
  background: #151a1d;
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
  color: #a5adb1;
}

.evidence-step__location {
  overflow: hidden;
  color: #d5dad5;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evidence-step__note {
  display: -webkit-box;
  overflow: hidden;
  color: #aab2ae;
  font-size: 11px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.evidence-step__source {
  color: #6f7a7f;
  font-size: 9.5px;
}

.evidence-inspector {
  position: sticky;
  top: 16px;
  min-width: 0;
  padding: 17px 18px 15px;
  background: #101518;
}

.evidence-inspector__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid #2b3338;
}

.evidence-inspector__header h4 {
  margin: 5px 0 0;
  color: #edf0eb;
  font-size: 17px;
  font-weight: 700;
  text-transform: capitalize;
}

.evidence-inspector__section {
  padding: 13px 0;
  border-bottom: 1px solid #2b3338;
}

.evidence-inspector__section p {
  margin: 8px 0 0;
  color: #b7bfba;
  font-size: 11.5px;
  line-height: 1.62;
  white-space: pre-wrap;
}

.evidence-inspector__location {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 9px;
  color: #b8c0bb;
}

.evidence-inspector__location svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: #77838a;
}

.evidence-inspector__location code {
  overflow-wrap: anywhere;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 10.5px;
  line-height: 1.5;
}

.evidence-inspector__section small {
  display: block;
  margin-top: 6px;
  color: #707b80;
  font-size: 9.5px;
}

.evidence-inspector__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.evidence-inspector__facts > div {
  min-width: 0;
}

.evidence-inspector__facts strong {
  display: block;
  overflow: hidden;
  margin-top: 6px;
  color: #b9c0bc;
  font-size: 10.5px;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evidence-snippet {
  overflow: auto;
  max-height: 170px;
  margin: 9px 0 0;
  padding: 11px 12px;
  border: 1px solid #293136;
  border-radius: var(--radius-control);
  color: #afbeaf;
  background: #0a0e10;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 10px;
  line-height: 1.55;
  white-space: pre;
}

.evidence-snippet--empty {
  color: #69747a;
  white-space: normal;
}

.evidence-inspector__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 17px;
}

.evidence-inspector__navigation {
  display: flex;
  gap: 6px;
}

.trace-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 31px;
  padding: 0 10px;
  border: 1px solid #364046;
  border-radius: var(--radius-control);
  color: #bdc4c0;
  background: #171d20;
  font-size: 9.5px;
  font-weight: 630;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
}

.trace-button:hover:not(:disabled) {
  border-color: #58656c;
  color: #eef1ed;
  background: #1d2529;
}

.trace-button--nav {
  padding-inline: 7px;
}

.trace-button--next:not(:disabled) {
  border-color: #98c94f;
  color: #11160c;
  background: #a9df59;
  font-weight: 720;
}

.trace-button--next:hover:not(:disabled) {
  border-color: #b8ed6b;
  color: #10140b;
  background: #b4e968;
}

.trace-button:disabled {
  color: #566167;
  background: #111619;
  cursor: not-allowed;
}

.evidence-inspector__feedback {
  min-height: 17px;
  margin: 7px 0 -7px;
  color: #8b978f;
  font-size: 9px;
}

.evidence-trace__empty {
  display: flex;
  min-height: 340px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 30px;
  color: #707a80;
  text-align: center;
}

.evidence-trace__empty strong {
  color: #cbd0ca;
  font-size: 13px;
}

.evidence-trace__empty span {
  max-width: 430px;
  font-size: 11px;
  line-height: 1.55;
}

@container (max-width: 880px) {
  .evidence-trace__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .evidence-trace__summary {
    width: 100%;
    flex-wrap: wrap;
  }

  .evidence-trace__layout {
    grid-template-columns: 1fr;
  }

  .evidence-trace__sequence {
    border-right: 0;
    border-bottom: 1px solid #283036;
  }

  .evidence-inspector {
    position: static;
  }
}

@container (max-width: 560px) {
  .evidence-trace__sequence {
    padding-inline: 14px;
  }

  .evidence-trace__sequence-heading {
    padding-left: 39px;
  }

  .evidence-trace__sequence-heading small {
    display: none;
  }

  .evidence-list__item,
  .evidence-step {
    grid-template-columns: 39px minmax(0, 1fr);
  }

  .evidence-step__marker {
    width: 28px;
    height: 28px;
  }

  .evidence-list__rail {
    top: 27px;
    left: 13px;
  }

  .evidence-step__topline {
    align-items: flex-start;
    flex-direction: column;
    gap: 7px;
  }
}
</style>
