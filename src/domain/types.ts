export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'unknown'

export type Confidence = 'high' | 'medium' | 'low' | 'unknown'

export type ReachabilityStatus = 'reachable' | 'unreachable' | 'unknown' | 'unavailable'

export type EvidenceKind = 'investigation' | 'usage' | 'unavailable'

export type JobStatus =
  | 'queued'
  | 'uploading'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ScanMode = 'auto' | 'deep' | 'shallow'

export type ReportFormat = 'json' | 'sarif'

export type AuthMode = 'authentik' | 'token'

export interface SeverityCounts {
  critical: number
  high: number
  medium: number
  low: number
  unknown: number
}

export interface AggregateTotals extends SeverityCounts {
  total: number
}

export interface SourceLocation {
  file: string
  lineStart: number | null
  lineEnd: number | null
  snippet: string | null
}

export interface Dependency {
  name: string
  version: string
  ecosystem: string
  sourceFile: string
  lineRange: readonly [number | null, number | null]
  raw: unknown
  relationship: string | null
  depth: number | null
  introducers: string[]
  purl: string | null
  isSelf: boolean
}

export interface UsageProbe {
  name: string
  sites: SourceLocation[]
  truncated: boolean
}

export interface FindingPaths {
  declaredAt: SourceLocation | null
  probes: UsageProbe[]
  symbol: string | null
  symbolSites: SourceLocation[]
  coverage: string
}

export interface EvidenceNode {
  id: string
  file: string
  line: number | null
  lineEnd: number | null
  role: string
  note: string
  verified: boolean
  snippet: string | null
  source: 'investigation' | 'usage'
}

export interface EvidenceEdge {
  id: string
  source: string
  target: string
}

export interface Investigation {
  verdict: string
  confidence: Confidence
  reasoning: string
  evidenceRefs: string[]
  evidenceChain: EvidenceNode[]
  clampedReason: string | null
}

export interface Finding {
  id: string
  scanId: string
  tool: string
  category: string
  ruleId: string
  message: string
  severity: Severity
  confidence: Confidence
  locations: SourceLocation[]
  fix: string | null
  dependency: Dependency | null
  deepInvestigable: boolean
  reachability: ReachabilityStatus
  paths: FindingPaths | null
  investigation: Investigation | null
  evidenceNodes: EvidenceNode[]
  evidenceEdges: EvidenceEdge[]
  evidenceKind: EvidenceKind
  raw: unknown
}

export interface ReportMetadata {
  scanId: string
  mode: ScanMode
  startedAt: string
  finishedAt: string
  toolVersions: Record<string, string>
}

export interface ScanReport {
  scanId: string
  projectName: string
  projectSlug: string
  metadata: ReportMetadata
  findings: Finding[]
  severityCounts: SeverityCounts
  degraded: boolean
  degradedReasons: string[]
  raw: unknown
}

export interface ScanJob {
  id: string
  projectName: string
  projectPath: string
  mode: ScanMode
  format: ReportFormat
  force: boolean
  status: JobStatus
  progress: number
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  findingCount: number
  severityCounts: SeverityCounts
  activity: string[]
  error: string | null
  reportScanId: string | null
}

export interface ScanCreateInput {
  projectPath: string
  mode: ScanMode
  format: ReportFormat
  force: boolean
}

export interface AppSettings {
  serverUrl: string
  authMode: AuthMode
  tokenUrl: string
  clientId: string
  username: string
  scope: string
}

export type SettingsUpdate = Partial<AppSettings>

export interface RuntimeInfo {
  version: string
  platform: string
  binaryPath: string
}

export interface ClientStatus {
  connected: boolean
  authenticated: boolean
  serverUrl: string
  checkedAt: string
  message: string
  runtime: RuntimeInfo
}

export interface AuthentikLoginInput {
  mode: 'authentik'
  serverUrl: string
  tokenUrl: string
  clientId: string
  username: string
  password: string
  scope: string
}

export interface TokenLoginInput {
  mode: 'token'
  serverUrl: string
  token: string
}

export type LoginInput = AuthentikLoginInput | TokenLoginInput

export interface ActionResult {
  success: boolean
  message: string
}

export function emptySeverityCounts(): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 }
}

export function severityTotal(counts: SeverityCounts): number {
  return counts.critical + counts.high + counts.medium + counts.low + counts.unknown
}
