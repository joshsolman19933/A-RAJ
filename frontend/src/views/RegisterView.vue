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

async function handleRegister() {
  error.value = '';
  loading.value = true;
  try {
    await auth.register(username.value, password.value);
    router.push('/hive');
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value = err?.response?.data?.message || 'Regisztráció sikertelen';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[80vh] px-4">
    <form
      class="w-full max-w-sm space-y-6"
      @submit.prevent="handleRegister"
    >
      <h1 class="text-2xl font-bold text-center text-red-500">
        Regisztráció
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
          minlength="3"
          maxlength="20"
          class="w-full px-4 py-2 bg-black/60 border border-red-950/50 rounded focus:border-red-700 outline-none text-zinc-200"
          placeholder="Válassz felhasználónevet"
        />
      </div>

      <div>
        <label class="block text-sm text-zinc-400 mb-1">Jelszó</label>
        <input
          v-model="password"
          type="password"
          required
          minlength="6"
          class="w-full px-4 py-2 bg-black/60 border border-red-950/50 rounded focus:border-red-700 outline-none text-zinc-200"
          placeholder="Minimum 6 karakter"
        />
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="w-full py-3 bg-red-900 hover:bg-red-800 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
      >
        {{ loading ? 'Regisztráció...' : 'Regisztráció' }}
      </button>

      <p class="text-center text-sm text-zinc-500">
        Van már fiókod?
        <router-link
          to="/login"
          class="text-red-500 hover:text-red-400"
        >
          Belépés
        </router-link>
      </p>
    </form>
  </div>
</template>
