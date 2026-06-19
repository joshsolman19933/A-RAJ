<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    router.push('/hive');
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value = err?.response?.data?.message || 'Bejelentkezés sikertelen';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[80vh] px-4">
    <form
      class="w-full max-w-sm space-y-6"
      @submit.prevent="handleLogin"
    >
      <h1 class="text-2xl font-bold text-center text-red-500">
        Belépés
      </h1>

      <div
        v-if="error"
        class="p-3 bg-red-950/50 border border-red-800 rounded text-sm text-red-300"
      >
        {{ error }}
      </div>

      <div>
        <label class="block text-sm text-zinc-400 mb-1">Felhasználónév</label>
        <input
          v-model="username"
          type="text"
          required
          class="w-full px-4 py-2 bg-black/60 border border-red-950/50 rounded focus:border-red-700 outline-none text-zinc-200"
          placeholder="Felhasználónév"
        />
      </div>

      <div>
        <label class="block text-sm text-zinc-400 mb-1">Jelszó</label>
        <input
          v-model="password"
          type="password"
          required
          class="w-full px-4 py-2 bg-black/60 border border-red-950/50 rounded focus:border-red-700 outline-none text-zinc-200"
          placeholder="Jelszó"
        />
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="w-full py-3 bg-red-900 hover:bg-red-800 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
      >
        {{ loading ? 'Belépés...' : 'Belépés' }}
      </button>

      <p class="text-center text-sm text-zinc-500">
        Nincs még fiókod?
        <router-link
          to="/register"
          class="text-red-500 hover:text-red-400"
        >
          Regisztráció
        </router-link>
      </p>
    </form>
  </div>
</template>
