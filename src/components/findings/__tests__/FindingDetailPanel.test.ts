import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return { ...actual, useMessage: () => ({ warning: vi.fn() }) }
})

import FindingDetailPanel from '@/components/findings/FindingDetailPanel.vue'
import { normalizedFixtureReports } from '@/data/fixtureReports'

describe('FindingDetailPanel scan context', () => {
  it('shows report context and emits the source job when Open scan is used', async () => {
    const finding = normalizedFixtureReports[0]?.findings[0]
    expect(finding).toBeTruthy()
    if (!finding) return

    const wrapper = mount(FindingDetailPanel, {
      props: {
        finding,
        projectName: 'JobCV Frontend',
        scanFinishedAt: '2026-08-17T11:22:46.598779Z',
        sourceJobId: 'job-frontend',
      },
      global: { stubs: { EvidenceTrace: true } },
    })

    expect(wrapper.text()).toContain('JobCV Frontend')
    expect(wrapper.text()).toContain('Scan: Aug 17')

    const openButton = wrapper.findAll('button').find((button) => button.text().includes('Open scan'))
    expect(openButton).toBeTruthy()
    await openButton?.trigger('click')
    expect(wrapper.emitted('openScan')).toEqual([['job-frontend']])
  })

  it('does not render a fake Open scan action without a source job', () => {
    const finding = normalizedFixtureReports[0]?.findings[0]
    expect(finding).toBeTruthy()
    if (!finding) return

    const wrapper = mount(FindingDetailPanel, {
      props: { finding },
      global: { stubs: { EvidenceTrace: true } },
    })
    expect(wrapper.text()).not.toContain('Open scan')
  })

  it('supports a route-controlled tab and an h1 page heading', async () => {
    const finding = normalizedFixtureReports[0]?.findings[0]
    expect(finding).toBeTruthy()
    if (!finding) return

    const wrapper = mount(FindingDetailPanel, {
      props: {
        finding,
        activeTab: 'evidence',
        headingTag: 'h1',
      },
      global: { stubs: { EvidenceTrace: true } },
    })

    expect(wrapper.get('h1.finding-detail__rule-heading').text()).toBe(finding.ruleId)
    expect(wrapper.get('#finding-tab-evidence').attributes('aria-selected')).toBe('true')
    expect(wrapper.text()).toContain('Evidence trace')

    await wrapper.get('#finding-tab-raw').trigger('click')
    expect(wrapper.emitted('update:activeTab')).toContainEqual(['raw'])
  })
})
