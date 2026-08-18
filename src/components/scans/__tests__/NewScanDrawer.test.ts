import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import NewScanDrawer from '@/components/scans/NewScanDrawer.vue'

describe('NewScanDrawer', () => {
  it('validates the project path before emitting a scan request', async () => {
    const wrapper = shallowMount(NewScanDrawer, {
      props: { show: true },
      global: { renderStubDefaultSlot: true },
    })

    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Choose a project directory before starting the scan.')
    expect(wrapper.emitted('submit')).toBeUndefined()

    await wrapper.setProps({ projectPath: '/workspace/example-app' })
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]).toEqual([
      {
        projectPath: '/workspace/example-app',
        mode: 'deep',
        format: 'json',
        force: false,
      },
    ])
  })
})
