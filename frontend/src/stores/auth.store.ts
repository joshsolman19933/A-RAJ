import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AuthPayload } from '@a-raj/shared';
import { authService } from '@/services/auth.service';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('araj_token'));
  const refreshToken = ref<string | null>(
    localStorage.getItem('araj_refresh_token'),
  );
  const user = ref<AuthPayload | null>(
    JSON.parse(localStorage.getItem('araj_user') || 'null'),
  );

  const isLoggedIn = computed(() => !!token.value);
  const username = computed(() => user.value?.username || '');

  async function login(username: string, password: string) {
    const res = await authService.login(username, password);
    persistAuth(res);
  }

  async function register(username: string, password: string) {
    const res = await authService.register(username, password);
    persistAuth(res);
  }

  async function refresh() {
    if (!refreshToken.value) {
      throw new Error('No refresh token available');
    }
    try {
      const res = await authService.refresh(refreshToken.value);
      persistAuth(res);
    } catch {
      logout();
      throw new Error('Session expired');
    }
  }

  function persistAuth(res: {
    token: string;
    refreshToken: string;
    user: AuthPayload;
  }) {
    token.value = res.token;
    refreshToken.value = res.refreshToken;
    user.value = res.user;
    localStorage.setItem('araj_token', res.token);
    localStorage.setItem('araj_refresh_token', res.refreshToken);
    localStorage.setItem('araj_user', JSON.stringify(res.user));
  }

  async function logout() {
    try {
      await authService.logout();
    } catch {
      // Ignore server errors during logout
    }
    token.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem('araj_token');
    localStorage.removeItem('araj_refresh_token');
    localStorage.removeItem('araj_user');
  }

  return { token, refreshToken, user, isLoggedIn, username, login, register, refresh, logout };
});
