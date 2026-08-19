import { describe, expect, it } from 'vitest'

import { normalizedFixtureReports } from '@/data/fixtureReports'
import { aggregateReportTotals, normalizeReport } from '@/data/normalizeReport'

describe('report normalization', () => {
  it('normalizes all fixtures and preserves the expected aggregate totals', () => {
    expect(normalizedFixtureReports).toHaveLength(3)
    expect(aggregateReportTotals(normalizedFixtureReports)).toEqual({
      total: 153,
      critical: 1,
      high: 61,
      medium: 86,
      low: 5,
      unknown: 0,
    })
    expect(normalizedFixtureReports.map((report) => report.projectSlug)).toEqual([
      'jobcv-frontend',
      'jobcv-backend',
      'teacherAI-frontend',
    ])
  })

  it('merges investigated findings by shallow finding id', () => {
    const backend = normalizedFixtureReports.find(
      (report) => report.projectSlug === 'jobcv-backend',
    )
    const critical = backend?.findings.find(
      (finding) => finding.id === '8dcd5eff-e857-5bf7-8b41-83cd83013d14',
    )

    expect(critical?.investigation?.verdict).toBe('unknown')
    expect(critical?.investigation?.reasoning).toContain('basic-ftp 5.0.5')
    expect(critical?.evidenceKind).toBe('investigation')
    expect(critical?.evidenceNodes[0]).toMatchObject({
      file: 'package-lock.json',
      line: 761,
      role: 'import',
      verified: true,
      source: 'investigation',
    })
  })

  it('falls back to usage evidence from probe and symbol sites', () => {
    const backend = normalizedFixtureReports.find(
      (report) => report.projectSlug === 'jobcv-backend',
    )
    const uninvestigated = backend?.findings.find(
      (finding) => finding.id === 'bd2c5fbd-a596-55ad-8e7e-22f057491fe6',
    )

    expect(uninvestigated?.investigation).toBeNull()
    expect(uninvestigated?.evidenceKind).toBe('usage')
    expect(uninvestigated?.evidenceNodes).toHaveLength(4)
    expect(uninvestigated?.evidenceNodes[0]).toMatchObject({
      file: 'config/nodemailer.js',
      line: 1,
      role: 'import',
      verified: false,
      snippet: null,
    })
    expect(uninvestigated?.evidenceNodes.map((node) => node.file)).toEqual([
      'config/nodemailer.js',
      'controllers/JobController.js',
      'controllers/JobApplicationController.js',
      'controllers/AuthController.js',
    ])
    expect(uninvestigated).not.toHaveProperty('evidenceEdges')
  })

  it('preserves unavailable reachability and null snippets without fabricating source', () => {
    const backend = normalizedFixtureReports.find(
      (report) => report.projectSlug === 'jobcv-backend',
    )
    const dependencyFinding = backend?.findings.find((finding) => finding.tool === 'trivy')
    const sastFinding = backend?.findings.find((finding) => finding.tool === 'opengrep')

    expect(dependencyFinding?.reachability).toBe('unavailable')
    expect(dependencyFinding?.locations[0]?.snippet).toBeNull()
    expect(sastFinding?.reachability).toBe('unknown')
    expect(sastFinding?.locations[0]?.snippet).toBeNull()
  })

  it('returns safe defaults for a malformed report instead of throwing', () => {
    const report = normalizeReport({ findings: [{ severity: 'unexpected' }] }, 'Broken', 'broken')

    expect(report.scanId).toBe('malformed-broken')
    expect(report.findings).toHaveLength(1)
    expect(report.findings[0]).toMatchObject({
      severity: 'unknown',
      reachability: 'unknown',
      locations: [],
      evidenceKind: 'unavailable',
    })
    expect(report.severityCounts.unknown).toBe(1)
  })
})
