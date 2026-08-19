<script setup lang="ts">
import { Bug, LayoutDashboard, ListChecks, Settings } from '@lucide/vue'
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const settingsStore = useSettingsStore()

const navigation = [
  { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Scans', to: '/scans', icon: ListChecks },
  { label: 'Findings', to: '/findings', icon: Bug },
  { label: 'Settings', to: '/settings', icon: Settings },
]

function isCurrent(path: string) {
  return path === '/dashboard'
    ? route.path === path
    : route.path === path || route.path.startsWith(`${path}/`)
}

const connectionLabel = computed(() =>
  settingsStore.status.connected ? 'Connected' : 'Not connected',
)

const endpointLabel = computed(() => {
  const value = settingsStore.status.serverUrl || settingsStore.settings.serverUrl
  if (!value) return 'No endpoint configured'
  try {
    return new URL(value).host
  } catch {
    return value
  }
})

onMounted(() => settingsStore.initialize())
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" aria-label="Application navigation">
      <RouterLink class="brand" to="/dashboard" aria-label="SecSource overview">
        <span class="brand-mark" aria-hidden="true">
          <img src="/secsource-mark.svg" alt="" />
        </span>
        <strong class="brand-name">SecSource</strong>
      </RouterLink>

      <nav class="primary-nav" aria-label="Primary">
        <span class="nav-caption">Navigation</span>
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          class="nav-item"
          :class="{ current: isCurrent(item.to) }"
          :to="item.to"
          :aria-current="isCurrent(item.to) ? 'page' : undefined"
        >
          <component :is="item.icon" :size="17" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <section class="scanner-state" aria-label="Scanner connection status">
        <div class="scanner-state__heading">
          <span
            class="connection-dot"
            :class="{ offline: !settingsStore.status.connected }"
            aria-hidden="true"
          />
          <span>{{ connectionLabel }}</span>
        </div>
        <p class="scanner-state__endpoint mono">{{ endpointLabel }}</p>
        <p class="scanner-state__meta">Scanner API · v{{ settingsStore.runtime.version }}</p>
      </section>
    </aside>

    <main class="workspace">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  padding-left: 216px;
  background: #0b0e10;
  isolation: isolate;
}

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 100;
  display: flex;
  width: 216px;
  height: 100vh;
  flex-direction: column;
  border-right: 1px solid #22282d;
  background: #0c1012;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  contain: layout paint;
  isolation: isolate;
}

.sidebar > * {
  position: relative;
  z-index: 1;
}

.brand {
  display: flex;
  min-height: 78px;
  align-items: center;
  gap: 11px;
  padding: 0 18px;
  color: #f4f5f2;
  text-decoration: none;
}

.brand-mark {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
}

.brand-mark img {
  display: block;
  width: 38px;
  height: 38px;
}

.brand-name {
  font-family: 'v-mono', 'SFMono-Regular', Consolas, monospace;
  font-size: 20px;
  font-weight: 400;
  letter-spacing: -0.055em;
  line-height: 1;
}

.primary-nav {
  display: grid;
  gap: 4px;
  padding: 22px 12px;
}

.nav-caption {
  padding: 0 10px 9px;
  color: #69737a;
  font-size: 11px;
  font-weight: 600;
}

.nav-item {
  position: relative;
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 11px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #9ca4a9;
  font-size: 14px;
  font-weight: 560;
  text-decoration: none;
  transition: 120ms ease;
}

.nav-item:hover {
  color: #e7e9e5;
  background: #13181c;
}

.nav-item.current {
  color: #f5f7f0;
  background: #171c18;
}

.nav-item.current::before {
  position: absolute;
  left: -12px;
  width: 2px;
  height: 22px;
  border-radius: 0 2px 2px 0;
  background: #b7ef45;
  content: '';
}

.nav-item.current :deep(svg) {
  color: #b7ef45;
}

.scanner-state {
  margin: auto 12px 14px;
  padding: 13px 10px 2px;
  border-top: 1px solid #252c31;
}

.scanner-state__heading {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #dce2d8;
  font-size: 12px;
  font-weight: 650;
}

.connection-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9bdd45;
}

.connection-dot.offline {
  background: #f0ad38;
}

.scanner-state__endpoint {
  margin: 9px 0 4px;
  overflow: hidden;
  color: #aeb5ba;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scanner-state__meta {
  margin: 0;
  color: #6e787e;
  font-size: 11px;
}

.workspace {
  position: relative;
  z-index: 0;
  min-width: 0;
  min-height: 100vh;
  overflow: clip;
  contain: paint;
  isolation: isolate;
}

.workspace :deep(.vue-flow) {
  position: relative;
  z-index: 0;
  overflow: hidden;
  transform: translate3d(0, 0, 0);
  clip-path: inset(0);
  contain: layout paint;
  isolation: isolate;
}

@media (max-width: 1080px) {
  .app-shell {
    padding-left: 72px;
  }

  .sidebar {
    width: 72px;
    align-items: center;
  }

  .brand {
    width: 100%;
    justify-content: center;
    padding: 0;
  }

  .brand-name,
  .nav-caption,
  .nav-item span,
  .scanner-state {
    display: none;
  }

  .primary-nav {
    width: 100%;
    padding: 22px 10px;
  }

  .nav-item {
    justify-content: center;
    padding: 0;
  }

  .nav-item.current::before {
    left: -11px;
  }
}
</style>
