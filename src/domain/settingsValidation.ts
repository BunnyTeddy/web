import type { AuthMode } from '@/domain/types'

export type SettingsValidationErrors = Partial<
  Record<'serverUrl' | 'tokenUrl' | 'clientId' | 'username' | 'password' | 'scope' | 'token', string>
>

export interface LoginFields {
  authMode: AuthMode
  serverUrl: string
  tokenUrl: string
  clientId: string
  username: string
  password: string
  scope: string
  accessToken: string
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateServerEndpoint(serverUrl: string): SettingsValidationErrors {
  if (!serverUrl.trim()) return { serverUrl: 'Server endpoint is required.' }
  if (!isHttpUrl(serverUrl)) return { serverUrl: 'Enter a valid HTTP or HTTPS URL.' }
  return {}
}

export function validateLoginFields(fields: LoginFields): SettingsValidationErrors {
  const errors = validateServerEndpoint(fields.serverUrl)

  if (fields.authMode === 'token') {
    if (!fields.accessToken.trim()) errors.token = 'Access token is required.'
    return errors
  }

  if (!fields.tokenUrl.trim()) errors.tokenUrl = 'Token URL is required.'
  else if (!isHttpUrl(fields.tokenUrl)) {
    errors.tokenUrl = 'Enter a valid HTTP or HTTPS URL.'
  }
  if (!fields.clientId.trim()) errors.clientId = 'Client ID is required.'
  if (!fields.username.trim()) errors.username = 'Username is required.'
  if (!fields.password) errors.password = 'Password is required.'
  if (!fields.scope.trim()) errors.scope = 'Scope is required.'

  return errors
}
