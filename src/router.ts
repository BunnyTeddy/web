import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/OverviewView.vue'),
    },
    { path: '/scans', name: 'scans', component: () => import('@/views/ScansView.vue') },
    {
      path: '/findings',
      name: 'findings',
      component: () => import('@/views/FindingsView.vue'),
    },
    {
      path: '/findings/:scanId',
      name: 'scan-findings',
      component: () => import('@/views/FindingsView.vue'),
      props: true,
    },
    {
      path: '/findings/:scanId/:findingId',
      name: 'finding-detail',
      component: () => import('@/views/FindingDetailView.vue'),
      props: true,
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})
