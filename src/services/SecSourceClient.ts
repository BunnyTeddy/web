import type {
  ActionResult,
  AppSettings,
  ClientStatus,
  LoginInput,
  ScanCreateInput,
  ScanJob,
  ScanReport,
  SettingsUpdate,
} from '@/domain/types'

export interface SecSourceClient {
  getStatus(serverUrl?: string): Promise<ClientStatus>
  selectProjectDirectory(): Promise<string | null>
  listScans(): Promise<ScanJob[]>
  createScan(input: ScanCreateInput): Promise<ScanJob>
  cancelScan(jobId: string): Promise<ScanJob>
  getReport(scanId: string): Promise<ScanReport>
  getSettings(): Promise<AppSettings>
  saveSettings(update: SettingsUpdate): Promise<AppSettings>
  login(input: LoginInput): Promise<ActionResult>
}
