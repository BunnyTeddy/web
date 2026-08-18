<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    forId: string
    hint?: string | undefined
    error?: string | undefined
    required?: boolean
  }>(),
  {
    hint: '',
    error: '',
    required: false,
  },
)
</script>

<template>
  <div class="field-group" :class="{ 'field-group--invalid': error }">
    <label :for="forId">
      {{ label }}
      <span v-if="required" aria-hidden="true">*</span>
    </label>
    <slot />
    <span v-if="error" class="field-group__error" role="alert">{{ error }}</span>
    <span v-else-if="hint" class="field-group__hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.field-group {
  min-width: 0;
}

.field-group label {
  display: block;
  margin-bottom: 8px;
  color: #b5bcb8;
  font-size: 12px;
  font-weight: 640;
}

.field-group label span {
  color: #e7b84b;
}

.field-group__hint,
.field-group__error {
  display: block;
  margin-top: 7px;
  font-size: 11px;
  line-height: 1.45;
}

.field-group__hint {
  color: #727d82;
}

.field-group__error {
  color: #ee7a70;
}

.field-group--invalid :deep(.n-input) {
  --n-border: 1px solid rgb(242 109 95 / 65%) !important;
  --n-border-hover: 1px solid #f26d5f !important;
  --n-border-focus: 1px solid #f26d5f !important;
  --n-box-shadow-focus: 0 0 0 2px rgb(242 109 95 / 10%) !important;
}
</style>
