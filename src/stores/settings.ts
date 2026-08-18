import { ref } from 'vue'
import { defineStore } from 'pinia'

import type {
  ActionResult,
  AppSettings,
  ClientStatus,
  LoginInput,
  RuntimeInfo,
  SettingsUpdate,
} from '@/domain/types'
import { secSourceClient } from '@/services/client'
import { MOCK_RUNTIME } from '@/services/MockSecSourceClient'

const EMPTY_SETTINGS: AppSettings = {
  serverUrl: '',
  authMode: 'authentik',
  tokenUrl: '',
  clientId: '',
  username: '',
  scope: 'api',
}

const INITIAL_STATUS: ClientStatus = {
  connected: false,
  authenticated: false,
  serverUrl: '',
  checkedAt: '',
  message: 'Connection has not been checked',
  runtime: { ...MOCK_RUNTIME },
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...EMPTY_SETTINGS })
  const runtime = ref<RuntimeInfo>({ ...MOCK_RUNTIME })
  const status = ref<ClientStatus>({ ...INITIAL_STATUS })
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  async function initialize(): Promise<void> {
    if (initialized.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      settings.value = await secSourceClient.getSettings()
      status.value = await secSourceClient.getStatus()
      runtime.value = { ...status.value.runtime }
      initialized.value = true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Unable to load settings'
    } finally {
      loading.value = false
    }
  }

  async function testConnection(serverUrl = settings.value.serverUrl): Promise<ActionResult> {
    loading.value = true
    error.value = null
    try {
      status.value = await secSourceClient.getStatus(serverUrl)
      runtime.value = { ...status.value.runtime }
      return { success: status.value.connected, message: status.value.message }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Connection test failed'
      error.value = message
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  async function saveSettings(update: SettingsUpdate): Promise<ActionResult> {
    loading.value = true
    error.value = null
    try {
      settings.value = await secSourceClient.saveSettings(update)
      return { success: true, message: 'Settings saved for this session' }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to save settings'
      error.value = message
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  async function login(input: LoginInput): Promise<ActionResult> {
    loading.value = true
    error.value = null
    try {
      const result = await secSourceClient.login(input)
      settings.value = await secSourceClient.getSettings()
      status.value = await secSourceClient.getStatus()
      return result
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Authentication failed'
      error.value = message
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  return {
    settings,
    runtime,
    status,
    loading,
    error,
    initialized,
    initialize,
    testConnection,
    saveSettings,
    login,
  }
})
