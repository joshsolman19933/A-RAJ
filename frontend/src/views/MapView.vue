<script setup lang="ts">
// MapView.vue — Placeholder for Sprint 3.2
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();

if (!auth.isLoggedIn) {
  router.push('/login');
}
</script>

<template>
  <div class="p-4 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold text-red-500 mb-4">
      &#8982; Világtérkép
    </h1>
    <div class="p-6 border border-red-950/30 rounded-lg bg-black/40">
      <p class="text-zinc-500">
        A hexagonális világtérkép a Phase 3-ban lesz implementálva (Sprint 3.1-3.2).
        Itt fog megjelenni a Canvas alapú hexa térkép, a kaptárak, hegyek, tavak és PvE fészkek.
      </p>
    </div>
  </div>
</template>
