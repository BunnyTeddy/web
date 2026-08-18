import type { SecSourceClient } from '@/services/SecSourceClient'
import { MockSecSourceClient } from '@/services/MockSecSourceClient'

// The UI depends on this interface-bound adapter. The future Go API client can replace
// this single construction point without changing views or Pinia stores.
export const secSourceClient: SecSourceClient = new MockSecSourceClient()
