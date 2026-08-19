import type { EvidenceKind, EvidenceNode } from '@/domain/types'

export type EvidenceLevel = 'verified' | 'inferred' | 'usage'

export function evidenceLevelForNode(
  node: EvidenceNode,
  kind: EvidenceKind,
): EvidenceLevel {
  if (kind === 'usage' || node.source === 'usage') return 'usage'
  return node.verified ? 'verified' : 'inferred'
}

export function formatEvidenceLocation(node: EvidenceNode): string {
  const file = node.file || 'Unknown file'
  if (node.line === null) return file
  if (node.lineEnd !== null && node.lineEnd !== node.line) {
    return `${file}:${node.line}-${node.lineEnd}`
  }
  return `${file}:${node.line}`
}

export function evidenceLevelLabel(level: EvidenceLevel): string {
  if (level === 'verified') return 'Verified location'
  if (level === 'usage') return 'Usage-only evidence'
  return 'Inferred evidence'
}

export function evidenceSourceLabel(node: EvidenceNode): string {
  return node.source === 'usage' ? 'Usage fallback' : 'Investigation'
}
