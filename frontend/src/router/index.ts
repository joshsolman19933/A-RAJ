import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
    },
    {
      path: '/hive',
      name: 'hive',
      component: () => import('../views/HiveView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('../views/MapView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/military',
      name: 'military',
      component: () => import('../views/MilitaryView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/mutations',
      name: 'mutations',
      component: () => import('../views/MutationView.vue'),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to, _from) => {
  // Auth guard: redirect to login if route requires auth and user has no session
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('araj_token');
    const refreshToken = localStorage.getItem('araj_refresh_token');
    // Allow access if either access token or refresh token exists
    // (the axios interceptor will auto-refresh if access token is expired)
    if (!token && !refreshToken) {
      return { name: 'login' };
    }
  }
  // Allow navigation
  return true;
});
