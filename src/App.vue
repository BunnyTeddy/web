<script setup lang="ts">
import { darkTheme, NConfigProvider, NDialogProvider, NMessageProvider } from 'naive-ui'

import AppShell from '@/components/layout/AppShell.vue'
import { naiveThemeOverrides } from '@/styles/theme'
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="naiveThemeOverrides">
    <NMessageProvider placement="top-right">
      <NDialogProvider>
        <AppShell />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
