<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();

const logout = () => {
  auth.logout();
  router.push('/login');
};
</script>

<template>
  <div class="min-h-screen vein-bg flex flex-col">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-red-950/30 bg-black/60 backdrop-blur-sm">
      <div class="flex items-center justify-between px-4 py-2">
        <router-link
          to="/"
          class="text-xl font-bold text-red-700 tracking-wide"
        >
          A RAJ
        </router-link>
        <nav class="flex items-center gap-4">
          <template v-if="auth.isLoggedIn">
            <router-link
              to="/hive"
              class="text-sm text-zinc-400 hover:text-red-400 transition-colors"
            >
              Kaptár
            </router-link>
            <router-link
              to="/military"
              class="text-sm text-zinc-400 hover:text-red-400 transition-colors"
            >
              Sereg
            </router-link>
            <router-link
              to="/mutations"
              class="text-sm text-zinc-400 hover:text-red-400 transition-colors"
            >
              Mutációk
            </router-link>
            <router-link
              to="/map"
              class="text-sm text-zinc-400 hover:text-red-400 transition-colors"
            >
              Térkép
            </router-link>
            <span class="text-sm text-zinc-500">{{ auth.username }}</span>
            <button
              class="text-sm text-red-700 hover:text-red-500 transition-colors"
              @click="logout"
            >
              Kilépés
            </button>
          </template>
          <template v-else>
            <router-link
              to="/login"
              class="text-sm text-zinc-400 hover:text-red-400 transition-colors"
            >
              Belépés
            </router-link>
            <router-link
              to="/register"
              class="text-sm text-zinc-400 hover:text-red-400 transition-colors"
            >
              Regisztráció
            </router-link>
          </template>
        </nav>
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Bottom nav (mobile) -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-red-950/30 bg-black/80 backdrop-blur-sm">
      <div class="flex justify-around py-2">
        <router-link
          to="/"
          class="flex flex-col items-center text-xs text-zinc-500 hover:text-red-400"
        >
          <span class="text-lg">&#9679;</span>
          Főoldal
        </router-link>
        <router-link
          to="/hive"
          class="flex flex-col items-center text-xs text-zinc-500 hover:text-red-400"
        >
          <span class="text-lg">&#9763;</span>
          Kaptár
        </router-link>
        <router-link
          to="/map"
          class="flex flex-col items-center text-xs text-zinc-500 hover:text-red-400"
        >
          <span class="text-lg">&#8982;</span>
          Térkép
        </router-link>
      </div>
    </nav>
  </div>
</template>
