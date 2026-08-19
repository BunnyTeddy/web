<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, type HTMLAttributes } from 'vue'
import { storeToRefs } from 'pinia'
import {
  Check,
  CircleCheck,
  CircleX,
  KeyRound,
  LockKeyhole,
  LogIn,
  RefreshCw,
  Save,
  Server,
  Wifi,
} from '@lucide/vue'
import {
  NAlert,
  NButton,
  NInput,
  NSkeleton,
  NTabPane,
  NTabs,
  useMessage,
} from 'naive-ui'

import type { AuthMode, LoginInput } from '@/domain/types'
import {
  isHttpUrl,
  validateLoginFields,
  validateServerEndpoint,
  type SettingsValidationErrors,
} from '@/domain/settingsValidation'
import FieldGroup from '@/components/settings/FieldGroup.vue'
import RuntimePanel from '@/components/settings/RuntimePanel.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { useReportsStore } from '@/stores/reports'
import { useScansStore } from '@/stores/scans'
import { useSettingsStore } from '@/stores/settings'

type Operation = 'test' | 'save' | 'login' | null

const message = useMessage()
const settingsStore = useSettingsStore()
const reportsStore = useReportsStore()
const scansStore = useScansStore()
const { settings, runtime, status, error: storeError } = storeToRefs(settingsStore)
const { reports, allFindings } = storeToRefs(reportsStore)
const { jobs } = storeToRefs(scansStore)

const isInitializing = ref(true)
const initializeError = ref('')
const operation = ref<Operation>(null)
const authMode = ref<AuthMode>('authentik')
const password = ref('')
const accessToken = ref('')
const errors = reactive<SettingsValidationErrors>({})

const form = reactive({
  serverUrl: '',
  tokenUrl: '',
  clientId: '',
  username: '',
  scope: 'api',
})

const authTabs: AuthMode[] = ['authentik', 'token']

function focusAuthTab(mode: AuthMode) {
  void nextTick(() => document.getElementById(`auth-tab-${mode}`)?.focus())
}

function handleAuthTabKeydown(event: KeyboardEvent, mode: AuthMode) {
  const currentIndex = authTabs.indexOf(mode)
  let target: AuthMode | undefined

  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    target = authTabs[currentIndex === 0 ? 1 : 0]
  } else if (event.key === 'Home') target = authTabs[0]
  else if (event.key === 'End') target = authTabs.at(-1)
  else if (event.key === 'Enter' || event.key === ' ') target = mode

  if (!target) return
  event.preventDefault()
  authMode.value = target
  resetErrors()
  focusAuthTab(target)
}

function authTabProps(mode: AuthMode): HTMLAttributes {
  const selected = authMode.value === mode
  return {
    id: `auth-tab-${mode}`,
    role: 'tab',
    tabindex: selected ? 0 : -1,
    'aria-selected': selected,
    'aria-controls': `auth-panel-${mode}`,
    onKeydown: (event: KeyboardEvent) => handleAuthTabKeydown(event, mode),
  }
}

const isConnected = computed(() => status.value.connected)
const isAuthenticated = computed(() => status.value.authenticated)

function resetErrors() {
  for (const key of Object.keys(errors) as Array<keyof SettingsValidationErrors>) {
    delete errors[key]
  }
}

function applyErrors(nextErrors: SettingsValidationErrors): boolean {
  resetErrors()
  Object.assign(errors, nextErrors)
  return Object.keys(errors).length === 0
}

function validateEndpoint(): boolean {
  return applyErrors(validateServerEndpoint(form.serverUrl))
}

function validateLogin(): boolean {
  return applyErrors(
    validateLoginFields({
      authMode: authMode.value,
      serverUrl: form.serverUrl,
      tokenUrl: form.tokenUrl,
      clientId: form.clientId,
      username: form.username,
      password: password.value,
      scope: form.scope,
      accessToken: accessToken.value,
    }),
  )
}

async function testConnection() {
  if (!validateEndpoint()) return
  operation.value = 'test'
  const result = await settingsStore.testConnection(form.serverUrl.trim())
  operation.value = null
  result.success ? message.success(result.message) : message.error(result.message)
}

async function saveConfiguration() {
  if (!validateEndpoint()) return
  if (form.tokenUrl.trim() && !isHttpUrl(form.tokenUrl)) {
    errors.tokenUrl = 'Enter a valid HTTP or HTTPS URL.'
    return
  }

  operation.value = 'save'
  const result = await settingsStore.saveSettings({
    serverUrl: form.serverUrl.trim(),
    authMode: authMode.value,
    tokenUrl: form.tokenUrl.trim(),
    clientId: form.clientId.trim(),
    username: form.username.trim(),
    scope: form.scope.trim(),
  })
  operation.value = null
  result.success ? message.success('Endpoint settings saved.') : message.error(result.message)
}

async function authenticate() {
  if (!validateLogin()) return

  const payload: LoginInput =
    authMode.value === 'token'
      ? {
          mode: 'token',
          serverUrl: form.serverUrl.trim(),
          token: accessToken.value,
        }
      : {
          mode: 'authentik',
          serverUrl: form.serverUrl.trim(),
          tokenUrl: form.tokenUrl.trim(),
          clientId: form.clientId.trim(),
          username: form.username.trim(),
          password: password.value,
          scope: form.scope.trim(),
        }

  operation.value = 'login'
  const result = await settingsStore.login(payload)
  operation.value = null
  if (result.success) {
    password.value = ''
    accessToken.value = ''
    message.success('Authentication successful.')
  } else {
    message.error(result.message)
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      settingsStore.initialize(),
      reportsStore.initialize(),
      scansStore.initialize(),
    ])
    form.serverUrl = settings.value.serverUrl
    form.tokenUrl = settings.value.tokenUrl
    form.clientId = settings.value.clientId
    form.username = settings.value.username
    form.scope = settings.value.scope
    authMode.value = settings.value.authMode
  } catch (error) {
    initializeError.value = error instanceof Error ? error.message : 'Unable to load local settings.'
  } finally {
    isInitializing.value = false
  }
})
</script>

<template>
  <div class="page-shell settings-page">
    <PageHeader
      kicker="Workspace configuration"
      title="Settings & authentication"
      description="Manage the scanner connection, authentication, and local runtime."
    />

    <NAlert v-if="initializeError || storeError" type="error" :bordered="true">
      {{ initializeError || storeError }}
    </NAlert>

    <div v-if="isInitializing" class="settings-loading">
      <NSkeleton height="420px" />
      <NSkeleton height="420px" />
    </div>

    <div v-else class="settings-grid">
      <div class="settings-main">
        <section class="settings-panel panel" aria-labelledby="server-settings-title">
          <header class="settings-panel__header">
            <div class="section-icon"><Server :size="17" /></div>
            <div>
              <h2 id="server-settings-title">Scanner server</h2>
              <p>The SecSource API endpoint that CLI commands will target.</p>
            </div>
            <span
              class="connection-chip"
              :class="{ 'connection-chip--online': isConnected }"
              role="status"
            >
              <component :is="isConnected ? CircleCheck : CircleX" :size="12" />
              {{ isConnected ? 'Connected' : 'Not connected' }}
            </span>
          </header>

          <div class="settings-panel__body">
            <FieldGroup
              label="Server endpoint"
              for-id="server-url"
              required
              hint="Example: https://scanner.secsource.internal"
              :error="errors.serverUrl"
            >
              <NInput
                v-model:value="form.serverUrl"
                :input-props="{ id: 'server-url' }"
                placeholder="https://scanner.example.com"
                autocomplete="url"
                @update:value="delete errors.serverUrl"
              >
                <template #prefix><Wifi :size="14" /></template>
              </NInput>
            </FieldGroup>

            <div class="action-row">
              <NButton
                secondary
                :loading="operation === 'test'"
                :disabled="operation !== null && operation !== 'test'"
                @click="testConnection"
              >
                <template #icon><RefreshCw :size="15" /></template>
                Test connection
              </NButton>
              <NButton
                type="primary"
                :loading="operation === 'save'"
                :disabled="operation !== null && operation !== 'save'"
                @click="saveConfiguration"
              >
                <template #icon><Save :size="15" /></template>
                Save endpoint
              </NButton>
            </div>
          </div>
        </section>

        <section class="settings-panel panel" aria-labelledby="auth-settings-title">
          <header class="settings-panel__header">
            <div class="section-icon"><KeyRound :size="17" /></div>
            <div>
              <h2 id="auth-settings-title">Authentication</h2>
              <p>Choose the authentication method supported by your scanner deployment.</p>
            </div>
            <span
              class="connection-chip"
              :class="{ 'connection-chip--online': isAuthenticated }"
              role="status"
            >
              <component :is="isAuthenticated ? Check : LockKeyhole" :size="12" />
              {{ isAuthenticated ? 'Authenticated' : 'Sign in required' }}
            </span>
          </header>

          <div class="auth-tabs">
            <NTabs v-model:value="authMode" type="segment" animated @update:value="resetErrors">
              <NTabPane name="authentik" tab="Authentik login" :tab-props="authTabProps('authentik')">
                <div
                  id="auth-panel-authentik"
                  class="auth-form"
                  role="tabpanel"
                  aria-labelledby="auth-tab-authentik"
                >
                  <FieldGroup
                    label="Token URL"
                    for-id="token-url"
                    required
                    hint="OAuth token endpoint provided by Authentik."
                    :error="errors.tokenUrl"
                  >
                    <NInput
                      v-model:value="form.tokenUrl"
                      :input-props="{ id: 'token-url' }"
                      placeholder="https://auth.example.com/application/o/token/"
                      autocomplete="url"
                      @update:value="delete errors.tokenUrl"
                    />
                  </FieldGroup>

                  <div class="field-row">
                    <FieldGroup label="Client ID" for-id="client-id" required :error="errors.clientId">
                      <NInput
                        v-model:value="form.clientId"
                        :input-props="{ id: 'client-id' }"
                        placeholder="secsource-cli"
                        autocomplete="off"
                        @update:value="delete errors.clientId"
                      />
                    </FieldGroup>
                    <FieldGroup label="Scope" for-id="scope" required :error="errors.scope">
                      <NInput
                        v-model:value="form.scope"
                        :input-props="{ id: 'scope' }"
                        placeholder="api"
                        autocomplete="off"
                        @update:value="delete errors.scope"
                      />
                    </FieldGroup>
                  </div>

                  <div class="field-row">
                    <FieldGroup label="Username" for-id="username" required :error="errors.username">
                      <NInput
                        v-model:value="form.username"
                        :input-props="{ id: 'username' }"
                        placeholder="developer@example.com"
                        autocomplete="username"
                        @update:value="delete errors.username"
                      />
                    </FieldGroup>
                    <FieldGroup
                      label="Password"
                      for-id="password"
                      required
                      hint="Never written to store or browser storage."
                      :error="errors.password"
                    >
                      <NInput
                        v-model:value="password"
                        :input-props="{ id: 'password' }"
                        type="password"
                        show-password-on="mousedown"
                        placeholder="Enter password"
                        autocomplete="current-password"
                        @update:value="delete errors.password"
                      />
                    </FieldGroup>
                  </div>
                </div>
              </NTabPane>

              <NTabPane name="token" tab="Access token" :tab-props="authTabProps('token')">
                <div
                  id="auth-panel-token"
                  class="auth-form"
                  role="tabpanel"
                  aria-labelledby="auth-tab-token"
                >
                  <FieldGroup
                    label="Access token"
                    for-id="access-token"
                    required
                    :error="errors.token"
                  >
                    <NInput
                      v-model:value="accessToken"
                      :input-props="{ id: 'access-token' }"
                      type="password"
                      show-password-on="mousedown"
                      placeholder="Paste access token"
                      autocomplete="off"
                      @update:value="delete errors.token"
                    />
                  </FieldGroup>

                  <div class="credential-note">
                    <LockKeyhole :size="15" />
                    <span>
                      Access tokens are used for sign-in and are not saved with your settings.
                    </span>
                  </div>
                </div>
              </NTabPane>
            </NTabs>

            <div class="auth-action">
              <span>Authentication runs against the selected server endpoint above.</span>
              <NButton
                type="primary"
                :loading="operation === 'login'"
                :disabled="operation !== null && operation !== 'login'"
                @click="authenticate"
              >
                <template #icon><LogIn :size="15" /></template>
                {{ authMode === 'authentik' ? 'Sign in with Authentik' : 'Use access token' }}
              </NButton>
            </div>
          </div>
        </section>
      </div>

      <RuntimePanel
        :runtime="runtime"
        :status="status"
        :report-count="reports.length"
        :finding-count="allFindings.length"
        :job-count="jobs.length"
      />
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  min-height: 100%;
  flex-direction: column;
}

.settings-page > :deep(.n-alert) {
  margin-bottom: 18px;
}

.settings-loading,
.settings-grid {
  display: grid;
  align-items: start;
  grid-template-columns: minmax(620px, 1fr) minmax(320px, 360px);
  gap: 24px;
}

.settings-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 24px;
}

.settings-panel {
  overflow: hidden;
}

.settings-panel__header {
  display: grid;
  align-items: center;
  padding: 22px 24px;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 14px;
  border-bottom: 1px solid #283036;
}

.section-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid #343c42;
  border-radius: var(--radius-control);
  color: #c2c9c5;
  background: #171c20;
}

.settings-panel__header h2 {
  margin: 0;
  color: #ecefeb;
  font-size: 17px;
  font-weight: 680;
  letter-spacing: -0.015em;
}

.settings-panel__header p {
  margin: 5px 0 0;
  color: #7f898e;
  font-size: 12px;
  line-height: 1.45;
}

.connection-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 1px solid rgb(242 109 95 / 22%);
  border-radius: var(--radius-compact);
  color: #d9746b;
  background: rgb(242 109 95 / 4%);
  font-size: 11px;
  font-weight: 650;
}

.connection-chip--online {
  border-color: rgb(111 196 151 / 28%);
  color: #78cba1;
  background: rgb(111 196 151 / 5%);
}

.settings-panel__body {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 26px 24px 24px;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

.auth-tabs {
  padding: 20px 24px 24px;
}

:deep(.auth-tabs .n-tabs-rail) {
  padding: 4px;
  border: 1px solid #283036;
  background: #0c1012;
}

:deep(.auth-tabs .n-tabs-capsule) {
  background: #1a211f;
  box-shadow: inset 0 -2px #b7ef45;
}

:deep(.auth-tabs .n-tabs-tab) {
  color: #8f999e;
  font-weight: 560;
}

:deep(.auth-tabs .n-tabs-tab.n-tabs-tab--active) {
  color: #edf1eb;
  font-weight: 660;
}

.auth-form {
  display: flex;
  min-height: 222px;
  flex-direction: column;
  gap: 20px;
  padding: 24px 2px 10px;
}

.field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.credential-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 0 0;
  border-top: 1px solid #252d32;
  color: #879197;
  font-size: 12px;
  line-height: 1.55;
}

.credential-note svg {
  flex: 0 0 auto;
  margin-top: 2px;
  color: #9fa9a4;
}

.auth-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-top: 20px;
  border-top: 1px solid #283036;
}

.auth-action > span {
  max-width: 430px;
  color: #778287;
  font-size: 11px;
  line-height: 1.45;
}

@media (max-width: 1279px) {
  .settings-loading,
  .settings-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .settings-grid {
    gap: 20px;
  }
}

@media (max-width: 760px) {
  .settings-panel__header {
    grid-template-columns: 40px minmax(0, 1fr);
  }

  .connection-chip {
    grid-column: 2;
    width: max-content;
  }

  .field-row {
    grid-template-columns: 1fr;
  }

  .auth-action {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
