import { shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import JobDetailPanel from '@/components/scans/JobDetailPanel.vue'
import type { ScanJob } from '@/domain/types'

function makeJob(activity: string[]): ScanJob {
  return {
    id: 'scan-activity-test',
    projectName: 'Activity Test',
    projectPath: '/workspace/activity-test',
    mode: 'deep',
    format: 'json',
    force: false,
    status: 'completed',
    progress: 100,
    createdAt: '2026-08-18T08:00:00.000Z',
    startedAt: '2026-08-18T08:00:01.000Z',
    finishedAt: '2026-08-18T08:01:00.000Z',
    findingCount: 3,
    severityCounts: { critical: 0, high: 1, medium: 2, low: 0, unknown: 0 },
    activity,
    error: null,
    reportScanId: 'scan-activity-test',
  }
}

describe('JobDetailPanel scan activity', () => {
  it('renders every event in a keyboard-scrollable accessible log', () => {
    const longEvent = `Security engine output: ${'nested/dependency/path/'.repeat(12)}finding.json`
    const wrapper = shallowMount(JobDetailPanel, {
      props: {
        job: makeJob(['Project archive uploaded', longEvent, 'Report ready with 3 findings']),
      },
    })

    expect(wrapper.text()).toContain('Scan activity')
    expect(wrapper.text()).not.toContain('CLI activity')

    const log = wrapper.get('[role="log"]')
    expect(log.attributes('aria-label')).toBe('Scan activity')
    expect(log.attributes('tabindex')).toBe('0')
    expect(log.findAll('p')).toHaveLength(3)
    expect(log.text()).toContain(longEvent)
    expect(log.text()).toContain('Report ready with 3 findings')
  })

  it('follows newly appended lifecycle events', async () => {
    const initialJob = makeJob(['Scan request queued'])
    const wrapper = shallowMount(JobDetailPanel, { props: { job: initialJob } })
    const log = wrapper.get<HTMLElement>('[role="log"]')
    Object.defineProperty(log.element, 'scrollHeight', { configurable: true, value: 340 })

    await wrapper.setProps({
      job: makeJob(['Scan request queued', 'Uploading project archive to scanner']),
    })
    await nextTick()

    expect(log.element.scrollTop).toBe(340)
    expect(log.text()).toContain('Uploading project archive to scanner')
  })

  it('does not steal the scroll position when the reader moved away from the tail', async () => {
    const wrapper = shallowMount(JobDetailPanel, {
      props: { job: makeJob(['First event', 'Second event']) },
    })
    const log = wrapper.get<HTMLElement>('[role="log"]')
    Object.defineProperties(log.element, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
    })
    log.element.scrollTop = 40
    await log.trigger('scroll')

    await wrapper.setProps({ job: makeJob(['First event', 'Second event', 'Third event']) })
    await nextTick()

    expect(log.element.scrollTop).toBe(40)
  })
})
