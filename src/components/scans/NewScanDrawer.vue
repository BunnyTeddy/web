<script setup lang="ts">
import { FolderOpen, Play, ShieldAlert, X } from '@lucide/vue'
import {
  NAlert,
  NButton,
  NCheckbox,
  NDrawer,
  NDrawerContent,
  NInput,
  NSelect,
} from 'naive-ui'
import { reactive, ref, watch } from 'vue'

import type { ScanCreateInput } from '@/domain/types'

const props = defineProps<{
  show: boolean
  projectPath?: string
  choosing?: boolean
  submitting?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  choose: []
  submit: [input: ScanCreateInput]
}>()

const form = reactive<ScanCreateInput>({
  projectPath: '',
  mode: 'deep',
  format: 'json',
  force: false,
})
const validationError = ref('')

const modeOptions = [
  { label: 'Auto — let the scanner choose', value: 'auto' },
  { label: 'Deep — full investigation', value: 'deep' },
  { label: 'Shallow — fast dependency and SAST scan', value: 'shallow' },
]

const formatOptions = [
  { label: 'JSON report', value: 'json' },
  { label: 'SARIF report', value: 'sarif' },
]

watch(
  () => props.projectPath,
  (value) => {
    if (value) form.projectPath = value
  },
  { immediate: true },
)

watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) validationError.value = ''
  },
)

function close() {
  if (!props.submitting) emit('update:show', false)
}

function submit() {
  validationError.value = ''
  if (!form.projectPath.trim()) {
    validationError.value = 'Choose a project directory before starting the scan.'
    return
  }
  emit('submit', { ...form, projectPath: form.projectPath.trim() })
}
</script>

<template>
  <NDrawer
    :show="show"
    :width="470"
    placement="right"
    :mask-closable="!submitting"
    @update:show="emit('update:show', $event)"
  >
    <NDrawerContent :native-scrollbar="false" closable @close="close">
      <template #header>
        <div class="drawer-title">
          <span class="title-icon"><ShieldAlert :size="17" aria-hidden="true" /></span>
          <span>
            <b>New security scan</b>
            <small>Configure project and report options</small>
          </span>
        </div>
      </template>

      <form id="new-scan-form" class="scan-form" novalidate @submit.prevent="submit">
        <div class="field-group">
          <label for="project-path">Project directory</label>
          <div class="folder-control">
            <NInput
              v-model:value="form.projectPath"
              :input-props="{
                id: 'project-path',
                'aria-describedby': 'project-path-hint',
              }"
              placeholder="/path/to/project"
            />
            <NButton
              type="default"
              :loading="choosing"
              aria-label="Choose project directory"
              @click="emit('choose')"
            >
              <template #icon><FolderOpen :size="16" /></template>
              Choose
            </NButton>
          </div>
          <span id="project-path-hint" class="field-hint">
            Select the root directory of the project you want to scan.
          </span>
        </div>

        <div class="field-grid">
          <div class="field-group">
            <label for="scan-mode">Scan mode</label>
            <NSelect
              v-model:value="form.mode"
              :options="modeOptions"
              :input-props="{ id: 'scan-mode', 'aria-label': 'Scan mode' }"
            />
          </div>
          <div class="field-group">
            <label for="report-format">Report format</label>
            <NSelect
              v-model:value="form.format"
              :options="formatOptions"
              :input-props="{ id: 'report-format', 'aria-label': 'Report format' }"
            />
          </div>
        </div>

        <label class="force-option">
          <NCheckbox v-model:checked="form.force" />
          <span>
            <b>Force fresh scan</b>
            <small>Ignore any matching cached scan result.</small>
          </span>
        </label>

        <NAlert v-if="validationError || error" type="error" :bordered="true">
          {{ validationError || error }}
        </NAlert>

        <section class="command-preview" aria-label="Command preview">
          <span class="eyebrow">Equivalent CLI action</span>
          <code>
            <span>$</span> secsource-cli scan {{ form.projectPath || '&lt;project&gt;' }} --mode
            {{ form.mode }} --format {{ form.format }}<template v-if="form.force"> --force</template>
          </code>
        </section>
      </form>

      <template #footer>
        <div class="drawer-actions">
          <NButton :disabled="submitting" @click="close">
            <template #icon><X :size="15" /></template>
            Cancel
          </NButton>
          <NButton
            type="primary"
            attr-type="submit"
            form="new-scan-form"
            :loading="submitting"
          >
            <template #icon><Play :size="15" /></template>
            Start scan
          </NButton>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.drawer-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-title > span:last-child {
  display: grid;
  gap: 2px;
}

.drawer-title b {
  color: #f1f3ee;
  font-size: 16px;
  letter-spacing: -0.015em;
}

.drawer-title small {
  color: #858f95;
  font-size: 12px;
  font-weight: 500;
}

.title-icon {
  display: grid;
  width: 31px;
  height: 31px;
  place-items: center;
  border: 1px solid #41502f;
  border-radius: 5px;
  color: #b7ef45;
  background: #151b13;
}

.scan-form {
  display: grid;
  gap: 26px;
  padding-top: 12px;
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field-group {
  display: grid;
  gap: 8px;
}

.field-group label,
.command-preview .eyebrow {
  color: #b2b9bd;
  font-size: 12px;
  font-weight: 650;
}

.folder-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.field-hint {
  color: #747e84;
  font-size: 11px;
  line-height: 1.45;
}

.force-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 15px 0;
  border-top: 1px solid #283036;
  border-bottom: 1px solid #283036;
  cursor: pointer;
}

.force-option > span {
  display: grid;
  gap: 3px;
}

.force-option b {
  color: #d8dcd7;
  font-size: 13px;
}

.force-option small {
  color: #7b858b;
  font-size: 11px;
}

.command-preview {
  display: grid;
  gap: 10px;
  padding: 15px;
  border: 1px solid #273037;
  border-radius: 5px;
  background: #090c0e;
}

.command-preview code {
  overflow-wrap: anywhere;
  color: #9da6aa;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 11px;
  line-height: 1.7;
}

.command-preview code span {
  color: #b7ef45;
}

.drawer-actions {
  display: flex;
  width: 100%;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 840px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
