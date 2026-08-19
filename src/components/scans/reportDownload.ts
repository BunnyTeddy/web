import type { ReportFormat, ScanReport } from '@/domain/types'

export interface ReportDownload {
  filename: string
  mimeType: 'application/json' | 'application/sarif+json'
  content: string
  blob: Blob
}

function safeFilenameSegment(value: string, fallback: string): string {
  const safe = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return safe || fallback
}

export function serializeRawReport(report: ScanReport): string {
  return JSON.stringify(report.raw, null, 2) ?? 'null'
}

export function buildReportDownload(report: ScanReport, format: ReportFormat): ReportDownload {
  const extension = format === 'sarif' ? 'sarif' : 'json'
  const mimeType = format === 'sarif' ? 'application/sarif+json' : 'application/json'
  const project = safeFilenameSegment(report.projectSlug, 'project')
  const scanId = safeFilenameSegment(report.scanId, 'scan')
  const content = serializeRawReport(report)

  return {
    filename: `secsource-${project}-${scanId}.${extension}`,
    mimeType,
    content,
    blob: new Blob([content], { type: mimeType }),
  }
}

export function triggerReportDownload(download: ReportDownload): void {
  const objectUrl = URL.createObjectURL(download.blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = download.filename
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}
