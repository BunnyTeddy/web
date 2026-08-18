import { describe, expect, it } from 'vitest'

import { validateLoginFields, validateServerEndpoint } from '@/domain/settingsValidation'

describe('settings form validation', () => {
  it('requires a valid HTTP or HTTPS server URL', () => {
    expect(validateServerEndpoint('')).toEqual({ serverUrl: 'Server endpoint is required.' })
    expect(validateServerEndpoint('scanner.local')).toEqual({
      serverUrl: 'Enter a valid HTTP or HTTPS URL.',
    })
    expect(validateServerEndpoint('https://scanner.example.test')).toEqual({})
  })

  it('keeps token and Authentik requirements mode-specific', () => {
    const base = {
      serverUrl: 'https://scanner.example.test',
      tokenUrl: '',
      clientId: '',
      username: '',
      password: '',
      scope: '',
      accessToken: '',
    }

    expect(validateLoginFields({ ...base, authMode: 'token' })).toEqual({
      token: 'Access token is required.',
    })
    expect(validateLoginFields({ ...base, authMode: 'authentik' })).toEqual({
      tokenUrl: 'Token URL is required.',
      clientId: 'Client ID is required.',
      username: 'Username is required.',
      password: 'Password is required.',
      scope: 'Scope is required.',
    })
  })
})
