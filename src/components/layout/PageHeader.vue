<script setup lang="ts">
defineProps<{
  kicker: string
  title: string
  description: string
}>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__copy">
      <span class="page-header__kicker">{{ kicker }}</span>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </div>

    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  margin-bottom: 28px;
}

.page-header__copy {
  min-width: 0;
}

.page-header__kicker {
  color: #879098;
  font-size: 12px;
  font-weight: 600;
}

.page-header h1 {
  margin: 7px 0;
  color: #f4f5f2;
  font-size: 32px;
  font-weight: 660;
  letter-spacing: -0.04em;
  line-height: 1;
}

.page-header p {
  margin: 0;
  color: #8c959a;
  font-size: 14px;
  line-height: 1.5;
}

.page-header__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-end;
  gap: 10px;
}

@media (max-width: 760px) {
  .page-header {
    align-items: stretch;
    flex-direction: column;
    gap: 18px;
  }

  .page-header__actions {
    width: 100%;
  }
}
</style>
