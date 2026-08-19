import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import EvidenceTrace from '../EvidenceTrace.vue'
import {
  evidenceLevelForNode,
  formatEvidenceLocation,
} from '../evidenceTraceModel'
import type { EvidenceNode } from '@/domain/types'

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

function evidenceNode(overrides: Partial<EvidenceNode> = {}): EvidenceNode {
  return {
    id: 'evidence-1',
    file: 'src/api/client.ts',
    line: 17,
    lineEnd: 19,
    role: 'introducer',
    note: 'Creates the client with a fixed base URL.',
    verified: true,
    snippet: 'const client = createClient(config)',
    source: 'investigation',
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

describe('evidence trace model', () => {
  it('derives truthful levels without promoting usage evidence', () => {
    expect(evidenceLevelForNode(evidenceNode(), 'investigation')).toBe('verified')
    expect(
      evidenceLevelForNode(evidenceNode({ verified: false }), 'investigation'),
    ).toBe('inferred')
    expect(
      evidenceLevelForNode(evidenceNode({ source: 'usage' }), 'investigation'),
    ).toBe('usage')
    expect(evidenceLevelForNode(evidenceNode(), 'usage')).toBe('usage')
  })

  it('formats files, single lines, ranges, and unknown lines', () => {
    expect(formatEvidenceLocation(evidenceNode())).toBe('src/api/client.ts:17-19')
    expect(formatEvidenceLocation(evidenceNode({ lineEnd: 17 }))).toBe(
      'src/api/client.ts:17',
    )
    expect(formatEvidenceLocation(evidenceNode({ lineEnd: null }))).toBe(
      'src/api/client.ts:17',
    )
    expect(formatEvidenceLocation(evidenceNode({ line: null, lineEnd: null }))).toBe(
      'src/api/client.ts',
    )
  })
})

describe('EvidenceTrace', () => {
  const steps = [
    evidenceNode({ id: 'import', role: 'import', line: 1, lineEnd: null }),
    evidenceNode({
      id: 'caller',
      file: 'src/components/ReportModal.tsx',
      line: 138,
      lineEnd: null,
      role: 'caller',
      note: 'Calls the affected client from the report flow.',
      verified: false,
      snippet: null,
    }),
  ]

  it('renders an ordered, read-only investigation trace without canvas controls', () => {
    const wrapper = mount(EvidenceTrace, {
      props: { steps, kind: 'investigation', reachability: 'unavailable' },
    })

    expect(wrapper.get('ol').attributes('aria-label')).toBe('Ordered evidence points')
    expect(wrapper.findAll('.evidence-step')).toHaveLength(2)
    expect(wrapper.text()).toContain('2 evidence points')
    expect(wrapper.text()).toContain('1 verified')
    expect(wrapper.text()).toContain('Reachability unavailable')
    expect(wrapper.text()).toContain(
      'Ordered investigation evidence; not a confirmed runtime call graph.',
    )
    expect(wrapper.find('.vue-flow').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/Play|Stop|Open source|pan|zoom/i)
  })

  it('selects evidence manually and respects Previous/Next boundaries', async () => {
    const wrapper = mount(EvidenceTrace, {
      props: { steps, kind: 'investigation', reachability: 'unknown' },
      attachTo: document.body,
    })

    const rows = wrapper.findAll<HTMLButtonElement>('.evidence-step')
    expect(rows[0]?.attributes('aria-current')).toBe('step')
    expect(wrapper.get('.evidence-inspector h4').text()).toBe('import')
    expect(wrapper.get('button[aria-label="Previous evidence"]').attributes()).toHaveProperty(
      'disabled',
    )

    await wrapper.get('button[aria-label="Next evidence"]').trigger('click')
    expect(wrapper.get('.evidence-inspector h4').text()).toBe('caller')
    expect(rows[1]?.attributes('aria-current')).toBe('step')
    expect(wrapper.get('button[aria-label="Next evidence"]').attributes()).toHaveProperty(
      'disabled',
    )

    await wrapper.get('button[aria-label="Previous evidence"]').trigger('click')
    expect(wrapper.get('.evidence-inspector h4').text()).toBe('import')
    wrapper.unmount()
  })

  it('supports ArrowUp, ArrowDown, Home, and End navigation', async () => {
    const wrapper = mount(EvidenceTrace, {
      props: { steps, kind: 'investigation' },
      attachTo: document.body,
    })
    const rows = wrapper.findAll<HTMLButtonElement>('.evidence-step')

    await rows[0]?.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.get('.evidence-inspector h4').text()).toBe('caller')
    expect(document.activeElement).toBe(rows[1]?.element)

    await rows[1]?.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.get('.evidence-inspector h4').text()).toBe('import')

    await rows[0]?.trigger('keydown', { key: 'End' })
    expect(wrapper.get('.evidence-inspector h4').text()).toBe('caller')

    await rows[1]?.trigger('keydown', { key: 'Home' })
    expect(wrapper.get('.evidence-inspector h4').text()).toBe('import')
    wrapper.unmount()
  })

  it('copies the selected source location and announces the result', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(EvidenceTrace, {
      props: { steps, kind: 'investigation' },
    })

    await wrapper.get('button[aria-label="Next evidence"]').trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Copy location'))
      ?.trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('src/components/ReportModal.tsx:138')
    expect(wrapper.get('[role="status"]').text()).toBe('Source location copied.')
  })

  it('announces clipboard failure without throwing', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    const wrapper = mount(EvidenceTrace, {
      props: { steps: [steps[0]!], kind: 'investigation' },
    })

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Copy location'))
      ?.trigger('click')

    expect(wrapper.get('[role="status"]').text()).toContain('Clipboard access is unavailable')
  })

  it('resets selection when a different finding provides new evidence', async () => {
    const wrapper = mount(EvidenceTrace, {
      props: { steps, kind: 'investigation' },
    })
    await wrapper.get('button[aria-label="Next evidence"]').trigger('click')
    expect(wrapper.get('.evidence-inspector h4').text()).toBe('caller')

    await wrapper.setProps({
      steps: [evidenceNode({ id: 'replacement', role: 'sink', line: 52 })],
    })
    expect(wrapper.get('.evidence-inspector h4').text()).toBe('sink')
    expect(wrapper.get('.evidence-step').attributes('aria-current')).toBe('step')
  })

  it('distinguishes usage-only evidence and never claims a source-to-sink path', () => {
    const wrapper = mount(EvidenceTrace, {
      props: {
        steps: [
          evidenceNode({
            id: 'usage',
            source: 'usage',
            verified: false,
            snippet: null,
          }),
        ],
        kind: 'usage',
        reachability: 'unavailable',
      },
    })

    expect(wrapper.text()).toContain('Usage evidence only')
    expect(wrapper.text()).toContain('do not confirm a source-to-sink call path')
    expect(wrapper.text()).toContain('Usage fallback')
    expect(wrapper.text()).toContain('Source snippet unavailable')
    expect(wrapper.get('.evidence-step').classes()).toContain('evidence-step--usage')
  })

  it('handles missing notes, snippets, and empty evidence', () => {
    const incomplete = mount(EvidenceTrace, {
      props: {
        steps: [evidenceNode({ note: '', snippet: null, line: null, lineEnd: null })],
        kind: 'investigation',
      },
    })
    expect(incomplete.text()).toContain('No investigation note was provided')
    expect(incomplete.text()).toContain('Source snippet unavailable')
    expect(incomplete.text()).toContain('Exact line unavailable')

    const empty = mount(EvidenceTrace, {
      props: { steps: [], kind: 'unavailable' },
    })
    expect(empty.text()).toContain('No evidence was reported')
    expect(empty.text()).toContain(
      'Ordered investigation evidence; not a confirmed runtime call graph.',
    )
  })
})
