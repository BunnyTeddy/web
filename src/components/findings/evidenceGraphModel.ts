export interface EvidenceStep {
  file: string
  line?: number | null
  lineEnd?: number | null
  role: string
  note?: string | null
  verified?: boolean
  snippet?: string | null
  source?: 'investigation' | 'usage'
}

export type EvidenceLevel = 'verified' | 'inferred' | 'usage'

export function evidenceLevelForStep(
  step: EvidenceStep,
  usageOnly = false,
): EvidenceLevel {
  if (usageOnly || step.source === 'usage') return 'usage'
  return step.verified ? 'verified' : 'inferred'
}

export function evidenceLevelForEdge(
  source: EvidenceStep,
  target: EvidenceStep,
  usageOnly = false,
): EvidenceLevel {
  if (usageOnly || source.source === 'usage' || target.source === 'usage') return 'usage'
  return source.verified && target.verified ? 'verified' : 'inferred'
}
