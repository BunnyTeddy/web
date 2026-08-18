import jobcvBackendRaw from '../../../secsource-cli/reports/jobcv_backend.json'
import jobcvFrontendRaw from '../../../secsource-cli/reports/jobcv_frontend.json'
import teacherAiFrontendRaw from '../../../secsource-cli/reports/teacherAI_frontend.json'

import type { ScanReport } from '@/domain/types'
import { normalizeReport } from '@/data/normalizeReport'

export interface FixtureDescriptor {
  projectName: string
  projectSlug: string
  projectPath: string
  raw: unknown
}

export const fixtureDescriptors: readonly FixtureDescriptor[] = [
  {
    projectName: 'JobCV Frontend',
    projectSlug: 'jobcv-frontend',
    projectPath: '/workspace/jobcv/frontend',
    raw: jobcvFrontendRaw,
  },
  {
    projectName: 'JobCV Backend',
    projectSlug: 'jobcv-backend',
    projectPath: '/workspace/jobcv/backend',
    raw: jobcvBackendRaw,
  },
  {
    projectName: 'TeacherAI Frontend',
    projectSlug: 'teacherAI-frontend',
    projectPath: '/workspace/teacherAI/frontend',
    raw: teacherAiFrontendRaw,
  },
] as const

export const normalizedFixtureReports: ScanReport[] = fixtureDescriptors.map((fixture) =>
  normalizeReport(fixture.raw, fixture.projectName, fixture.projectSlug),
)

export function freshFixtureReports(): ScanReport[] {
  return fixtureDescriptors.map((fixture) =>
    normalizeReport(fixture.raw, fixture.projectName, fixture.projectSlug),
  )
}
