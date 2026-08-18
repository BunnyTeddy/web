import { describe, expect, it } from 'vitest'

import {
  evidenceLevelForEdge,
  evidenceLevelForStep,
  type EvidenceStep,
} from '../evidenceGraphModel'

const verified: EvidenceStep = {
  file: 'src/server.ts',
  line: 24,
  role: 'caller',
  verified: true,
  source: 'investigation',
}

const inferred: EvidenceStep = {
  file: 'src/handler.ts',
  line: 42,
  role: 'sink',
  verified: false,
  source: 'investigation',
}

const usage: EvidenceStep = {
  file: 'src/imports.ts',
  line: 4,
  role: 'import',
  verified: false,
  source: 'usage',
}

describe('EvidenceGraph evidence levels', () => {
  it('uses only report verification data for investigation steps', () => {
    expect(evidenceLevelForStep(verified)).toBe('verified')
    expect(evidenceLevelForStep(inferred)).toBe('inferred')
  })

  it('keeps fallback usage evidence visually distinct', () => {
    expect(evidenceLevelForStep(usage)).toBe('usage')
    expect(evidenceLevelForEdge(usage, verified)).toBe('usage')
    expect(evidenceLevelForEdge(verified, inferred)).toBe('inferred')
    expect(evidenceLevelForEdge(verified, verified)).toBe('verified')
  })

  it('does not present usage-only paths as verified', () => {
    expect(evidenceLevelForStep(verified, true)).toBe('usage')
    expect(evidenceLevelForEdge(verified, verified, true)).toBe('usage')
  })
})
