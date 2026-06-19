<script setup lang="ts">
// HomeView.vue — Landing page
import { useAuthStore } from '@/stores/auth.store';
import { RouterLink } from 'vue-router';

const auth = useAuthStore();
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
    <div class="max-w-lg">
      <!-- Organic sci-fi logo area -->
      <div class="mb-8">
        <div class="text-6xl font-black tracking-tighter text-red-800 animate-pulse">
          A RAJ
        </div>
        <p class="mt-3 text-lg text-zinc-500 italic">
          Építsd meg a kaptárad. Időzítsd a rajzást. Hódítsd meg a világot.
        </p>
      </div>

      <!-- Feature highlights -->
      <div class="grid gap-4 mb-10 text-left">
        <div class="p-4 border border-red-950/20 rounded-lg bg-black/40">
          <div class="text-red-500 font-semibold">
            &#9763; Organikus bázisépítés
          </div>
          <p class="text-sm text-zinc-500 mt-1">
            Kamrákat ásol a föld alatt hexagonális rácson. Nincs fa, nincs vas — minden organikus.
          </p>
        </div>
        <div class="p-4 border border-red-950/20 rounded-lg bg-black/40">
          <div class="text-red-500 font-semibold">
            &#9760; Élettartam rendszer
          </div>
          <p class="text-sm text-zinc-500 mt-1">
            A sereged pár nap alatt elhal. A sikeres invázió titka a tökéletesen időzített keltetési hullám.
          </p>
        </div>
        <div class="p-4 border border-red-950/20 rounded-lg bg-black/40">
          <div class="text-red-500 font-semibold">
            &#8982; Feromon-nyomok
          </div>
          <p class="text-sm text-zinc-500 mt-1">
            A klánvezérek izzó, pulzáló csápokat rajzolnak a térképre a szinkronizált támadások koordinálásához.
          </p>
        </div>
      </div>

      <!-- CTA -->
      <div
        v-if="!auth.isLoggedIn"
        class="flex gap-4 justify-center"
      >
        <RouterLink
          to="/register"
          class="px-8 py-3 bg-red-900 hover:bg-red-800 text-white rounded-lg font-semibold transition-all hover:shadow-lg hover:shadow-red-900/30"
        >
          Regisztráció
        </RouterLink>
        <RouterLink
          to="/login"
          class="px-8 py-3 border border-red-950 hover:border-red-800 text-zinc-300 rounded-lg font-semibold transition-all"
        >
          Belépés
        </RouterLink>
      </div>
      <div
        v-else
        class="flex gap-4 justify-center"
      >
        <RouterLink
          to="/hive"
          class="px-8 py-3 bg-red-900 hover:bg-red-800 text-white rounded-lg font-semibold transition-all"
        >
          Kaptáram
        </RouterLink>
        <RouterLink
          to="/map"
          class="px-8 py-3 border border-red-950 hover:border-red-800 text-zinc-300 rounded-lg font-semibold transition-all"
        >
          Térkép
        </RouterLink>
      </div>
    </div>
  </div>
</template>
