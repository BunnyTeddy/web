<script setup lang="ts">
import { computed, nextTick, ref, type HTMLAttributes } from 'vue'
import {
  Activity,
  Braces,
  Check,
  Copy,
  FileCode2,
  GitBranch,
  Package,
  ShieldAlert,
  Wrench,
  X,
} from '@lucide/vue'
import { NButton, NEmpty, NTabPane, NTabs, useMessage } from 'naive-ui'

import type { Finding } from '@/domain/types'
import EvidenceGraph from './EvidenceGraph.vue'
import type { EvidenceStep } from './evidenceGraphModel'
import SeverityBadge from './SeverityBadge.vue'

const props = withDefaults(
  defineProps<{
    finding?: Finding | null
    showClose?: boolean
  }>(),
  {
    finding: null,
    showClose: false,
  },
)

defineEmits<{
  close: []
}>()

const activeTab = ref('overview')
const copied = ref(false)
const message = useMessage()

const investigation = computed(() => props.finding?.investigation ?? null)

const evidenceSteps = computed<EvidenceStep[]>(() => {
  if (!props.finding) return []

  return props.finding.evidenceNodes.map((node) => ({
    file: node.file,
    line: node.line,
    lineEnd: node.lineEnd,
    role: node.role,
    note: node.note,
    verified: node.verified,
    snippet: node.snippet,
    source: node.source,
  }))
})

const rawJson = computed(() => (props.finding ? JSON.stringify(props.finding.raw, null, 2) : ''))

const reachability = computed(() => props.finding?.reachability || 'unavailable')

const detailTabs = ['overview', 'evidence', 'raw'] as const
type DetailTab = (typeof detailTabs)[number]

function focusDetailTab(name: DetailTab) {
  void nextTick(() => document.getElementById(`finding-tab-${name}`)?.focus())
}

function handleTabKeydown(event: KeyboardEvent, name: DetailTab) {
  const currentIndex = detailTabs.indexOf(name)
  let target: DetailTab | undefined

  if (event.key === 'ArrowRight') target = detailTabs[(currentIndex + 1) % detailTabs.length]
  else if (event.key === 'ArrowLeft') {
    target = detailTabs[(currentIndex - 1 + detailTabs.length) % detailTabs.length]
  } else if (event.key === 'Home') target = detailTabs[0]
  else if (event.key === 'End') target = detailTabs.at(-1)
  else if (event.key === 'Enter' || event.key === ' ') target = name

  if (!target) return
  event.preventDefault()
  activeTab.value = target
  focusDetailTab(target)
}

function detailTabProps(name: DetailTab): HTMLAttributes {
  const selected = activeTab.value === name
  return {
    id: `finding-tab-${name}`,
    role: 'tab',
    tabindex: selected ? 0 : -1,
    'aria-selected': selected,
    'aria-controls': `finding-panel-${name}`,
    onKeydown: (event: KeyboardEvent) => handleTabKeydown(event, name),
  }
}

const copyRuleId = async () => {
  if (!props.finding) return

  try {
    await navigator.clipboard.writeText(props.finding.ruleId)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    message.warning('Clipboard access is unavailable in this browser.')
  }
}
</script>

<template>
  <article v-if="finding" class="finding-detail">
    <header class="finding-detail__header">
      <div class="finding-detail__identity">
        <div class="finding-detail__meta">
          <SeverityBadge :severity="finding.severity" />
          <span class="finding-detail__divider" aria-hidden="true" />
          <span>{{ finding.tool }}</span>
          <span class="finding-detail__divider" aria-hidden="true" />
          <span>{{ finding.category }}</span>
        </div>
        <div class="finding-detail__rule-row">
          <h2 class="mono">{{ finding.ruleId }}</h2>
          <NButton
            quaternary
            size="tiny"
            :aria-label="`Copy ${finding.ruleId}`"
            @click="copyRuleId"
          >
            <template #icon>
              <Check v-if="copied" :size="14" />
              <Copy v-else :size="14" />
            </template>
          </NButton>
        </div>
      </div>

      <NButton
        v-if="showClose"
        quaternary
        circle
        aria-label="Close finding details"
        @click="$emit('close')"
      >
        <template #icon><X :size="18" /></template>
      </NButton>
    </header>

    <NTabs v-model:value="activeTab" type="line" animated class="finding-detail__tabs">
      <NTabPane name="overview" tab="Overview" :tab-props="detailTabProps('overview')">
        <div
          id="finding-panel-overview"
          class="finding-detail__content"
          role="tabpanel"
          aria-labelledby="finding-tab-overview"
        >
          <section class="detail-section detail-section--lead">
            <div class="detail-section__icon"><ShieldAlert :size="17" /></div>
            <div>
              <span class="detail-label">Finding</span>
              <p class="finding-message">{{ finding.message }}</p>
            </div>
          </section>

          <div class="status-grid">
            <section class="status-cell">
              <span class="detail-label">Reachability</span>
              <strong class="status-value status-value--unknown">
                <Activity :size="14" />
                {{ reachability }}
              </strong>
              <small>Runtime reachability is unavailable or not conclusively established.</small>
            </section>
            <section class="status-cell">
              <span class="detail-label">Exploitability</span>
              <strong class="status-value">
                {{ investigation?.verdict || 'Not investigated' }}
              </strong>
              <small>
                Confidence:
                <b>{{ investigation?.confidence || finding.confidence || 'unknown' }}</b>
              </small>
            </section>
          </div>

          <section v-if="investigation?.reasoning" class="detail-section">
            <div class="detail-section__heading">
              <GitBranch :size="15" />
              <span>Investigation reasoning</span>
            </div>
            <p class="body-copy">{{ investigation.reasoning }}</p>
            <p v-if="investigation.clampedReason" class="clamped-note">
              Verdict constrained: {{ investigation.clampedReason }}
            </p>
          </section>

          <section class="detail-section">
            <div class="detail-section__heading">
              <FileCode2 :size="15" />
              <span>Affected locations</span>
              <span class="section-count">{{ finding.locations.length }}</span>
            </div>
            <div v-if="finding.locations.length" class="location-list">
              <article v-for="(location, index) in finding.locations" :key="`${location.file}-${index}`" class="location-card">
                <div class="location-card__path mono">
                  {{ location.file }}<span v-if="location.lineStart !== null">:{{ location.lineStart }}</span>
                  <template v-if="location.lineEnd !== null && location.lineEnd !== location.lineStart">–{{ location.lineEnd }}</template>
                </div>
                <pre v-if="location.snippet" class="source-snippet"><code>{{ location.snippet }}</code></pre>
                <div v-else class="source-unavailable mono">Source snippet unavailable</div>
              </article>
            </div>
            <div v-else class="inline-empty">No source locations were reported.</div>
          </section>

          <section v-if="finding.dependency" class="detail-section">
            <div class="detail-section__heading">
              <Package :size="15" />
              <span>Dependency</span>
            </div>
            <dl class="property-grid">
              <div>
                <dt>Package</dt>
                <dd class="mono">{{ finding.dependency.name }}</dd>
              </div>
              <div>
                <dt>Installed version</dt>
                <dd class="mono">{{ finding.dependency.version }}</dd>
              </div>
              <div>
                <dt>Ecosystem</dt>
                <dd>{{ finding.dependency.ecosystem }}</dd>
              </div>
              <div>
                <dt>Relationship</dt>
                <dd>{{ finding.dependency.relationship || 'Unknown' }}</dd>
              </div>
              <div class="property-grid__wide">
                <dt>Package URL</dt>
                <dd class="mono">{{ finding.dependency.purl || 'Unavailable' }}</dd>
              </div>
            </dl>
          </section>

          <section class="detail-section detail-section--fix">
            <div class="detail-section__heading">
              <Wrench :size="15" />
              <span>Recommended fix</span>
            </div>
            <p v-if="finding.fix" class="fix-copy">{{ finding.fix }}</p>
            <p v-else class="body-copy muted">No automated remediation guidance was provided.</p>
          </section>
        </div>
      </NTabPane>

      <NTabPane name="evidence" tab="Evidence chain" :tab-props="detailTabProps('evidence')">
        <div
          id="finding-panel-evidence"
          class="finding-detail__content finding-detail__content--graph"
          role="tabpanel"
          aria-labelledby="finding-tab-evidence"
        >
          <EvidenceGraph
            :steps="evidenceSteps"
            :usage-only="finding.evidenceKind === 'usage'"
            :reachability="finding.reachability"
          />
        </div>
      </NTabPane>

      <NTabPane name="raw" tab="Raw JSON" :tab-props="detailTabProps('raw')">
        <div
          id="finding-panel-raw"
          class="finding-detail__content"
          role="tabpanel"
          aria-labelledby="finding-tab-raw"
        >
          <section class="raw-panel">
            <header>
              <div>
                <Braces :size="15" />
                <span>Original scanner finding payload</span>
              </div>
              <small>Escaped, read-only data</small>
            </header>
            <pre class="raw-json"><code>{{ rawJson }}</code></pre>
          </section>
        </div>
      </NTabPane>
    </NTabs>
  </article>

  <div v-else class="finding-detail finding-detail--empty">
    <NEmpty description="Select a finding to inspect its evidence and remediation." />
  </div>
</template>

<style scoped>
.finding-detail {
  min-width: 0;
  height: 100%;
  background: #101416;
}

.finding-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 23px 28px 19px;
  border-bottom: 1px solid #252c31;
}

.finding-detail__identity {
  min-width: 0;
}

.finding-detail__meta {
  display: flex;
  align-items: center;
  gap: 11px;
  color: #899398;
  font-size: 11px;
  font-weight: 600;
}

.finding-detail__divider {
  width: 1px;
  height: 12px;
  background: #30383d;
}

.finding-detail__rule-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 11px;
}

.finding-detail__rule-row h2 {
  overflow: hidden;
  margin: 0;
  color: #f1f3ef;
  font-size: 20px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.finding-detail__tabs {
  display: flex;
  min-height: 0;
  height: calc(100% - 91px);
  flex-direction: column;
}

:deep(.finding-detail__tabs > .n-tabs-nav) {
  padding: 0 28px;
  background: #101416;
}

:deep(.finding-detail__tabs .n-tabs-pane-wrapper) {
  overflow: hidden;
  min-height: 0;
  flex: 1;
}

:deep(.finding-detail__tabs .n-tab-pane) {
  overflow-y: auto;
  height: 100%;
}

.finding-detail__content {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 6px 28px 40px;
}

.finding-detail__content--graph {
  box-sizing: border-box;
  min-height: 0;
  height: 100%;
  padding: 16px 28px 22px;
}

.detail-section {
  padding: 22px 0;
  border-bottom: 1px solid #283036;
}

.detail-section--lead {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 13px;
  border-bottom: 0;
}

.detail-section__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgb(255 118 109 / 25%);
  border-radius: 7px;
  color: #ff766d;
  background: rgb(255 118 109 / 6%);
}

.detail-label {
  color: #8e989d;
  font-size: 11px;
  font-weight: 630;
}

.finding-message {
  margin: 8px 0 0;
  color: #e3e6e1;
  font-size: 15px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.status-grid {
  display: grid;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-block: 1px solid #283036;
}

.status-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  padding: 17px 0;
}

.status-cell + .status-cell {
  border-left: 1px solid #283036;
  padding-left: 22px;
}

.status-cell:first-child {
  padding-right: 22px;
}

.status-cell small {
  color: #7d878c;
  font-size: 12px;
  line-height: 1.5;
}

.status-cell small b {
  color: #aeb5b1;
  font-weight: 650;
  text-transform: capitalize;
}

.status-value {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #dbe0d9;
  font-size: 14px;
  text-transform: capitalize;
}

.status-value--unknown {
  color: #e0b358;
}

.detail-section__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  color: #d3d8d3;
  font-size: 13px;
  font-weight: 660;
}

.section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  margin-left: auto;
  padding: 0 5px;
  border: 1px solid #343c42;
  border-radius: 999px;
  color: #8d969b;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 10px;
}

.body-copy {
  margin: 0;
  color: #b2bab6;
  font-size: 13px;
  line-height: 1.72;
  white-space: pre-wrap;
}

.clamped-note {
  margin: 13px 0 0;
  padding: 10px 12px;
  border-left: 2px solid #d1a84e;
  color: #bca66f;
  background: #17150f;
  font-size: 12px;
  line-height: 1.55;
}

.location-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.location-card {
  overflow: hidden;
  border: 1px solid #283036;
  border-radius: 6px;
  background: #0d1114;
}

.location-card__path {
  padding: 11px 13px;
  color: #c9cec9;
  font-size: 12px;
}

.location-card__path span {
  color: #8cb8dc;
}

.source-snippet {
  overflow-x: auto;
  margin: 0;
  padding: 12px;
  border-top: 1px solid #232a2f;
  color: #b6c4b6;
  background: #0a0e10;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
}

.source-unavailable,
.inline-empty {
  padding: 12px 13px;
  border-top: 1px solid #232a2f;
  color: #687278;
  background: #0b0f11;
  font-size: 11px;
}

.inline-empty {
  border: 0;
  background: none;
  text-align: center;
}

.property-grid {
  display: grid;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-block: 1px solid #283036;
}

.property-grid > div {
  min-width: 0;
  padding: 13px 14px;
  border-bottom: 1px solid #283036;
}

.property-grid > div:nth-child(odd):not(.property-grid__wide) {
  border-right: 1px solid #283036;
}

.property-grid > div:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.property-grid .property-grid__wide {
  grid-column: 1 / -1;
  border-bottom: 0;
}

.property-grid dt {
  margin-bottom: 6px;
  color: #808a8f;
  font-size: 11px;
  font-weight: 620;
}

.property-grid dd {
  overflow: hidden;
  margin: 0;
  color: #c6ccc7;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-section--fix {
  border-bottom: 0;
}

.detail-section--fix .detail-section__heading {
  color: #80c7a1;
}

.fix-copy {
  margin: 0;
  color: #dce5d5;
  font-size: 13px;
  font-weight: 570;
  line-height: 1.6;
  white-space: pre-wrap;
}

.raw-panel {
  overflow: hidden;
  border: 1px solid #283036;
  border-radius: 7px;
  background: #0a0e10;
}

.raw-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 16px;
  border-bottom: 1px solid #283036;
  color: #c8cdc8;
  background: #111518;
}

.raw-panel header > div {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 650;
}

.raw-panel header small {
  color: #747e83;
  font-size: 10px;
}

.raw-json {
  overflow: auto;
  max-height: 650px;
  margin: 0;
  padding: 16px;
  color: #aebcaf;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre;
}

.finding-detail--empty {
  display: grid;
  min-height: 500px;
  place-items: center;
  padding: 32px;
}

@media (max-width: 1050px) {
  .finding-detail__header {
    padding-inline: 20px;
  }

  :deep(.finding-detail__tabs > .n-tabs-nav) {
    padding-inline: 20px;
  }

  .finding-detail__content {
    padding-inline: 20px;
  }
}
</style>
