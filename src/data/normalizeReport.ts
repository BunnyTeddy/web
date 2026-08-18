import type {
  Confidence,
  Dependency,
  EvidenceEdge,
  EvidenceKind,
  EvidenceNode,
  Finding,
  FindingPaths,
  Investigation,
  ReachabilityStatus,
  ScanMode,
  ScanReport,
  Severity,
  SeverityCounts,
  SourceLocation,
  UsageProbe,
} from '@/domain/types'
import { emptySeverityCounts } from '@/domain/types'

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {}
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function boolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function stringArray(value: unknown): string[] {
  return array(value).filter((item): item is string => typeof item === 'string')
}

function normalizeSeverity(value: unknown): Severity {
  const normalized = text(value).toLowerCase()
  return normalized === 'critical' ||
    normalized === 'high' ||
    normalized === 'medium' ||
    normalized === 'low'
    ? normalized
    : 'unknown'
}

function normalizeConfidence(value: unknown): Confidence {
  const normalized = text(value).toLowerCase()
  return normalized === 'high' || normalized === 'medium' || normalized === 'low'
    ? normalized
    : 'unknown'
}

function normalizeMode(value: unknown): ScanMode {
  const normalized = text(value).toLowerCase()
  return normalized === 'auto' || normalized === 'shallow' ? normalized : 'deep'
}

function normalizeLocation(value: unknown): SourceLocation {
  const input = record(value)
  return {
    file: text(input.file, 'Unknown file'),
    lineStart: numberOrNull(input.line_start),
    lineEnd: numberOrNull(input.line_end),
    snippet: nullableText(input.snippet),
  }
}

function normalizeDependency(value: unknown): Dependency | null {
  if (value === null || value === undefined) return null
  const input = record(value)
  const lineRange = array(input.line_range)
  return {
    name: text(input.name, 'Unknown dependency'),
    version: text(input.version, 'unknown'),
    ecosystem: text(input.ecosystem, 'unknown'),
    sourceFile: text(input.source_file, 'Unknown file'),
    lineRange: [numberOrNull(lineRange[0]), numberOrNull(lineRange[1])],
    raw: input.raw ?? null,
    relationship: nullableText(input.relationship),
    depth: numberOrNull(input.depth),
    introducers: stringArray(input.introducers),
    purl: nullableText(input.purl),
    isSelf: boolean(input.is_self),
  }
}

function normalizePaths(value: unknown): FindingPaths | null {
  if (value === null || value === undefined) return null
  const input = record(value)
  const probes: UsageProbe[] = array(input.probes).map((probeValue) => {
    const probe = record(probeValue)
    return {
      name: text(probe.name, 'dependency'),
      sites: array(probe.sites).map(normalizeLocation),
      truncated: boolean(probe.truncated),
    }
  })

  return {
    declaredAt:
      input.declared_at === null || input.declared_at === undefined
        ? null
        : normalizeLocation(input.declared_at),
    probes,
    symbol: nullableText(input.symbol),
    symbolSites: array(input.symbol_sites).map(normalizeLocation),
    coverage: text(input.coverage, 'unknown').toLowerCase(),
  }
}

function normalizeReachability(value: unknown, paths: FindingPaths | null): ReachabilityStatus {
  let candidate = value
  if (typeof value === 'object' && value !== null) {
    const reachability = record(value)
    candidate = reachability.status ?? reachability.reachability
  }

  const normalized = text(candidate).toLowerCase()
  if (normalized === 'reachable' || normalized === 'unreachable' || normalized === 'unavailable') {
    return normalized
  }
  if (paths?.coverage === 'unavailable') return 'unavailable'
  return 'unknown'
}

function normalizeInvestigation(
  value: unknown,
  findingId: string,
): Investigation | null {
  if (value === null || value === undefined) return null
  const wrapper = record(value)
  const exploitability = record(wrapper.exploitability)
  if (Object.keys(exploitability).length === 0) return null

  const evidenceChain: EvidenceNode[] = array(exploitability.evidence_chain).map(
    (nodeValue, index) => {
      const node = record(nodeValue)
      return {
        id: `${findingId}-investigation-${index}`,
        file: text(node.file, 'Unknown file'),
        line: numberOrNull(node.line),
        lineEnd: numberOrNull(node.line_end),
        role: text(node.role, 'evidence'),
        note: text(node.note, 'Investigation evidence'),
        verified: boolean(node.verified),
        snippet: nullableText(node.snippet),
        source: 'investigation',
      }
    },
  )

  return {
    verdict: text(exploitability.verdict, 'unknown'),
    confidence: normalizeConfidence(exploitability.confidence),
    reasoning: text(exploitability.reasoning, 'No investigation reasoning was provided.'),
    evidenceRefs: stringArray(exploitability.evidence_refs),
    evidenceChain,
    clampedReason: nullableText(exploitability.clamped_reason),
  }
}

function fallbackUsageEvidence(findingId: string, paths: FindingPaths | null): EvidenceNode[] {
  if (paths === null) return []

  const nodes: EvidenceNode[] = []
  const seen = new Set<string>()
  const addNode = (location: SourceLocation, role: string, note: string): void => {
    const key = `${location.file}:${location.lineStart ?? ''}:${role}`
    if (seen.has(key)) return
    seen.add(key)
    nodes.push({
      id: `${findingId}-usage-${nodes.length}`,
      file: location.file,
      line: location.lineStart,
      lineEnd: location.lineEnd,
      role,
      note,
      verified: false,
      snippet: location.snippet,
      source: 'usage',
    })
  }

  for (const probe of paths.probes) {
    for (const site of probe.sites) {
      addNode(site, 'import', `Usage site found for ${probe.name}`)
    }
  }
  for (const site of paths.symbolSites) {
    addNode(site, 'symbol', `Symbol usage found for ${paths.symbol ?? 'the vulnerable API'}`)
  }

  return nodes
}

function evidenceEdges(nodes: EvidenceNode[]): EvidenceEdge[] {
  return nodes.slice(1).map((node, index) => {
    const previous = nodes[index]
    return {
      id: `${previous?.id ?? 'evidence'}--${node.id}`,
      source: previous?.id ?? node.id,
      target: node.id,
    }
  })
}

function normalizeFinding(
  value: unknown,
  scanId: string,
  investigationValue: unknown,
): Finding {
  const input = record(value)
  const id = text(input.id, `unknown-${text(input.rule_id, 'finding')}`)
  const paths = normalizePaths(input.paths)
  const investigation = normalizeInvestigation(investigationValue, id)
  const investigationEvidence = investigation?.evidenceChain ?? []
  const usageEvidence =
    investigationEvidence.length === 0 ? fallbackUsageEvidence(id, paths) : []
  const evidenceNodes =
    investigationEvidence.length > 0 ? investigationEvidence : usageEvidence
  const evidenceKind: EvidenceKind =
    investigationEvidence.length > 0
      ? 'investigation'
      : usageEvidence.length > 0
        ? 'usage'
        : 'unavailable'

  return {
    id,
    scanId,
    tool: text(input.tool, 'unknown'),
    category: text(input.category, 'unknown'),
    ruleId: text(input.rule_id, 'Unknown rule'),
    message: text(input.message, 'No finding message was provided.'),
    severity: normalizeSeverity(input.severity),
    confidence: normalizeConfidence(input.confidence),
    locations: array(input.locations).map(normalizeLocation),
    fix: nullableText(input.fix),
    dependency: normalizeDependency(input.dependency),
    deepInvestigable: boolean(input.deep_investigable),
    reachability: normalizeReachability(input.reachability, paths),
    paths,
    investigation,
    evidenceNodes,
    evidenceEdges: evidenceEdges(evidenceNodes),
    evidenceKind,
    raw: value,
  }
}

function countSeverities(findings: Finding[]): SeverityCounts {
  const counts = emptySeverityCounts()
  for (const finding of findings) counts[finding.severity] += 1
  return counts
}

export function normalizeReport(
  value: unknown,
  projectName: string,
  projectSlug: string,
): ScanReport {
  const input = record(value)
  const metadataInput = record(input.metadata)
  const fallbackScanId = `malformed-${projectSlug}`
  const scanId = text(metadataInput.scan_id, fallbackScanId)

  const investigations = new Map<string, unknown>()
  for (const investigation of array(input.investigated_findings)) {
    const shallowFinding = record(record(investigation).shallow_finding)
    const findingId = text(shallowFinding.id)
    if (findingId) investigations.set(findingId, investigation)
  }

  const findings = array(input.findings).map((findingValue) => {
    const findingId = text(record(findingValue).id)
    return normalizeFinding(findingValue, scanId, investigations.get(findingId))
  })

  const toolVersions: Record<string, string> = {}
  for (const [tool, version] of Object.entries(record(metadataInput.tool_versions))) {
    if (typeof version === 'string') toolVersions[tool] = version
  }

  return {
    scanId,
    projectName,
    projectSlug,
    metadata: {
      scanId,
      mode: normalizeMode(metadataInput.mode),
      startedAt: text(metadataInput.started_at),
      finishedAt: text(metadataInput.finished_at),
      toolVersions,
    },
    findings,
    severityCounts: countSeverities(findings),
    degraded: boolean(input.degraded),
    degradedReasons: stringArray(metadataInput.degraded_reasons),
    raw: value,
  }
}

export function aggregateReportTotals(reports: ScanReport[]) {
  const counts = emptySeverityCounts()
  for (const report of reports) {
    counts.critical += report.severityCounts.critical
    counts.high += report.severityCounts.high
    counts.medium += report.severityCounts.medium
    counts.low += report.severityCounts.low
    counts.unknown += report.severityCounts.unknown
  }
  return {
    total: counts.critical + counts.high + counts.medium + counts.low + counts.unknown,
    ...counts,
  }
}
