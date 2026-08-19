import { describe, expect, it } from 'vitest'

import { buildReportDownload } from '@/components/scans/reportDownload'
import type { ScanReport } from '@/domain/types'

const report = {
  scanId: 'SCAN/001',
  projectName: 'Customer Portal',
  projectSlug: 'customer-portal',
  raw: { metadata: { scan_id: 'SCAN/001' }, findings: [{ id: 'finding-1' }] },
} as ScanReport

describe('report download', () => {
  it('builds a JSON download from the exact raw report payload', () => {
    const download = buildReportDownload(report, 'json')

    expect(download.filename).toBe('secsource-customer-portal-SCAN-001.json')
    expect(download.mimeType).toBe('application/json')
    expect(JSON.parse(download.content)).toEqual(report.raw)
    expect(download.blob.type).toBe('application/json')
  })

  it('uses the SARIF extension and MIME when the job requested SARIF', () => {
    const download = buildReportDownload(report, 'sarif')

    expect(download.filename).toBe('secsource-customer-portal-SCAN-001.sarif')
    expect(download.mimeType).toBe('application/sarif+json')
  })
})
