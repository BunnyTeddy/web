import { fixtureDescriptors, freshFixtureReports } from '@/data/fixtureReports'
import type {
  ActionResult,
  AppSettings,
  ClientStatus,
  LoginInput,
  RuntimeInfo,
  ScanCreateInput,
  ScanJob,
  ScanReport,
  SettingsUpdate,
} from '@/domain/types'
import { emptySeverityCounts } from '@/domain/types'
import type { SecSourceClient } from '@/services/SecSourceClient'

interface LifecycleDelays {
  uploading: number
  running: number
  completed: number
}

export interface MockSecSourceClientOptions {
  lifecycleDelays?: Partial<LifecycleDelays>
}

const DEFAULT_DELAYS: LifecycleDelays = {
  uploading: 800,
  running: 2_000,
  completed: 12_000,
}

const MOCK_CHECKED_AT = '2026-08-18T08:00:00.000Z'

const DEFAULT_SETTINGS: AppSettings = {
  serverUrl: 'https://scanner.secsource.local',
  authMode: 'authentik',
  tokenUrl: 'https://auth.secsource.local/application/o/token/',
  clientId: 'secsource-cli',
  username: 'developer@example.com',
  scope: 'api',
}

export const MOCK_RUNTIME: RuntimeInfo = {
  version: '0.1.0',
  platform: 'linux/amd64',
  binaryPath: './secsource-cli',
}

function cloneSettings(settings: AppSettings): AppSettings {
  return { ...settings }
}

function cloneJob(job: ScanJob): ScanJob {
  return {
    ...job,
    severityCounts: { ...job.severityCounts },
    activity: [...job.activity],
  }
}

function displayNameFromPath(projectPath: string): string {
  const trimmed = projectPath.replace(/[\\/]+$/, '')
  const segment = trimmed.split(/[\\/]/).filter(Boolean).at(-1) ?? 'Untitled project'
  return segment
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function slugFromPath(projectPath: string): string {
  return displayNameFromPath(projectPath).toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export class MockSecSourceClient implements SecSourceClient {
  readonly #delays: LifecycleDelays
  readonly #jobs = new Map<string, ScanJob>()
  readonly #reports = new Map<string, ScanReport>()
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>[]>()
  #settings = cloneSettings(DEFAULT_SETTINGS)
  #authenticated = true
  #jobSequence = 0

  constructor(options: MockSecSourceClientOptions = {}) {
    this.#delays = { ...DEFAULT_DELAYS, ...options.lifecycleDelays }
    const reports = freshFixtureReports()
    for (const [index, report] of reports.entries()) {
      this.#reports.set(report.scanId, report)
      const fixture = fixtureDescriptors[index]
      this.#jobs.set(report.scanId, {
        id: report.scanId,
        projectName: report.projectName,
        projectPath: fixture?.projectPath ?? `/workspace/${report.projectSlug}`,
        mode: report.metadata.mode,
        format: 'json',
        force: false,
        status: 'completed',
        progress: 100,
        createdAt: report.metadata.startedAt,
        startedAt: report.metadata.startedAt,
        finishedAt: report.metadata.finishedAt,
        findingCount: report.findings.length,
        severityCounts: { ...report.severityCounts },
        activity: [
          'Project archive uploaded',
          'Deep security analysis completed',
          `Report ready with ${report.findings.length} findings`,
        ],
        error: null,
        reportScanId: report.scanId,
      })
    }
  }

  async getStatus(serverUrl = this.#settings.serverUrl): Promise<ClientStatus> {
    await Promise.resolve()
    const connected = isValidUrl(serverUrl) && !serverUrl.includes('offline')
    return {
      connected,
      authenticated: connected && this.#authenticated,
      serverUrl,
      checkedAt: MOCK_CHECKED_AT,
      message: connected ? 'Scanner API is reachable' : 'Unable to reach scanner API',
      runtime: { ...MOCK_RUNTIME },
    }
  }

  async selectProjectDirectory(): Promise<string | null> {
    await Promise.resolve()
    return '/home/developer/projects/secsource-sample'
  }

  async listScans(): Promise<ScanJob[]> {
    await Promise.resolve()
    return [...this.#jobs.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(cloneJob)
  }

  async createScan(input: ScanCreateInput): Promise<ScanJob> {
    await Promise.resolve()
    if (input.projectPath.trim().length === 0) throw new Error('Project directory is required')

    this.#jobSequence += 1
    const id = `local-scan-${String(this.#jobSequence).padStart(3, '0')}`
    const createdAt = new Date(Date.now()).toISOString()
    const job: ScanJob = {
      id,
      projectName: displayNameFromPath(input.projectPath),
      projectPath: input.projectPath,
      mode: input.mode,
      format: input.format,
      force: input.force,
      status: 'queued',
      progress: 4,
      createdAt,
      startedAt: null,
      finishedAt: null,
      findingCount: 0,
      severityCounts: emptySeverityCounts(),
      activity: ['Scan request queued'],
      error: null,
      reportScanId: null,
    }
    this.#jobs.set(id, job)
    this.#scheduleLifecycle(id)
    return cloneJob(job)
  }

  async cancelScan(jobId: string): Promise<ScanJob> {
    await Promise.resolve()
    const job = this.#jobs.get(jobId)
    if (!job) throw new Error(`Scan job ${jobId} was not found`)
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(`A ${job.status} scan cannot be cancelled`)
    }

    this.#clearJobTimers(jobId)
    job.status = 'cancelled'
    job.finishedAt = new Date(Date.now()).toISOString()
    job.activity.push('Scan cancelled by user')
    return cloneJob(job)
  }

  async getReport(scanId: string): Promise<ScanReport> {
    await Promise.resolve()
    const report = this.#reports.get(scanId)
    if (!report) throw new Error(`Report ${scanId} is not available`)
    return report
  }

  async getSettings(): Promise<AppSettings> {
    await Promise.resolve()
    return cloneSettings(this.#settings)
  }

  async saveSettings(update: SettingsUpdate): Promise<AppSettings> {
    await Promise.resolve()
    if (update.serverUrl !== undefined && !isValidUrl(update.serverUrl)) {
      throw new Error('Server endpoint must be a valid HTTP or HTTPS URL')
    }
    if (update.tokenUrl !== undefined && update.tokenUrl.length > 0 && !isValidUrl(update.tokenUrl)) {
      throw new Error('Token URL must be a valid HTTP or HTTPS URL')
    }

    this.#settings = { ...this.#settings, ...update }
    return cloneSettings(this.#settings)
  }

  async login(input: LoginInput): Promise<ActionResult> {
    await Promise.resolve()
    if (!isValidUrl(input.serverUrl)) throw new Error('A valid server endpoint is required')
    if (input.mode === 'token') {
      if (input.token.trim().length === 0) throw new Error('Access token is required')
      this.#settings = { ...this.#settings, serverUrl: input.serverUrl, authMode: 'token' }
    } else {
      if (!isValidUrl(input.tokenUrl)) throw new Error('A valid token URL is required')
      if (!input.clientId.trim() || !input.username.trim() || !input.password.trim()) {
        throw new Error('Client ID, username and password are required')
      }
      this.#settings = {
        serverUrl: input.serverUrl,
        authMode: 'authentik',
        tokenUrl: input.tokenUrl,
        clientId: input.clientId,
        username: input.username,
        scope: input.scope,
      }
    }
    this.#authenticated = true
    return { success: true, message: 'Authenticated successfully' }
  }

  dispose(): void {
    for (const jobId of this.#timers.keys()) this.#clearJobTimers(jobId)
  }

  #scheduleLifecycle(jobId: string): void {
    const timers = [
      setTimeout(() => this.#transition(jobId, 'uploading'), this.#delays.uploading),
      setTimeout(() => this.#transition(jobId, 'running'), this.#delays.running),
      setTimeout(() => this.#transition(jobId, 'completed'), this.#delays.completed),
    ]
    this.#timers.set(jobId, timers)
  }

  #transition(jobId: string, status: 'uploading' | 'running' | 'completed'): void {
    const job = this.#jobs.get(jobId)
    if (!job || job.status === 'cancelled') return

    const now = new Date(Date.now()).toISOString()
    if (status === 'uploading') {
      job.status = status
      job.progress = 24
      job.startedAt = now
      job.activity.push('Uploading project archive to scanner')
      return
    }
    if (status === 'running') {
      job.status = status
      job.progress = 68
      job.activity.push('Security engines are analysing the project')
      return
    }

    job.status = 'completed'
    job.progress = 100
    job.finishedAt = now
    const report = this.#createDemoReport(job)
    this.#reports.set(report.scanId, report)
    job.reportScanId = report.scanId
    job.findingCount = report.findings.length
    job.severityCounts = { ...report.severityCounts }
    job.activity.push(`Report ready with ${report.findings.length} findings`)
    this.#clearJobTimers(jobId)
  }

  #createDemoReport(job: ScanJob): ScanReport {
    const template = this.#reports.values().next().value as ScanReport | undefined
    if (!template) throw new Error('No fixture report is available')
    const findings = template.findings.map((finding) => ({ ...finding, scanId: job.id }))
    return {
      ...template,
      scanId: job.id,
      projectName: job.projectName,
      projectSlug: slugFromPath(job.projectPath),
      metadata: {
        ...template.metadata,
        scanId: job.id,
        mode: job.mode,
        startedAt: job.startedAt ?? job.createdAt,
        finishedAt: job.finishedAt ?? job.createdAt,
      },
      findings,
      severityCounts: { ...template.severityCounts },
      degradedReasons: [...template.degradedReasons],
      raw: {
        generated_report: true,
        based_on_scan: template.scanId,
        metadata: {
          scan_id: job.id,
          mode: job.mode,
          started_at: job.startedAt ?? job.createdAt,
          finished_at: job.finishedAt ?? job.createdAt,
        },
        findings: findings.map((finding) => finding.raw),
      },
    }
  }

  #clearJobTimers(jobId: string): void {
    const timers = this.#timers.get(jobId) ?? []
    for (const timer of timers) clearTimeout(timer)
    this.#timers.delete(jobId)
  }
}
