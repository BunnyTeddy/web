import type { Directive } from 'vue'

function labelSelectionTrigger(root: HTMLElement, label: string) {
  const trigger = root.querySelector<HTMLElement>(
    '.n-base-selection-label, .n-base-selection-tags',
  )
  if (!trigger) return

  trigger.setAttribute('role', 'combobox')
  trigger.setAttribute('aria-label', label)
  trigger.setAttribute('aria-haspopup', 'listbox')
}

/** Adds the semantics Naive UI's visual select trigger does not expose itself. */
export const vAccessibleSelect: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    labelSelectionTrigger(element, binding.value)
  },
  updated(element, binding) {
    labelSelectionTrigger(element, binding.value)
  },
}
