<script setup lang="ts">
import { onMounted } from 'vue';
import { useMilitaryStore } from '@/stores/military.store';
import { useHiveStore } from '@/stores/hive.store';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'vue-router';
import Hatchery from '@/components/military/Hatchery.vue';
import MilitaryOverview from '@/components/military/MilitaryOverview.vue';

const militaryStore = useMilitaryStore();
const hiveStore = useHiveStore();
const auth = useAuthStore();
const router = useRouter();

if (!auth.isLoggedIn) {
  router.push('/login');
}

onMounted(async () => {
  if (!hiveStore.hasHive) {
    await hiveStore.fetchHive();
  }
  await militaryStore.fetchUnits();
});
</script>

<template>
  <div class="p-4 max-w-2xl mx-auto pb-20 md:pb-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-2xl font-bold text-red-500">Sereg</h1>
        <p class="text-xs text-zinc-600 mt-0.5">
          {{ militaryStore.totalUnits }} egység {{ militaryStore.unitsByType.length }} típusból
        </p>
      </div>
    </div>

    <!-- Error banner -->
    <div
      v-if="militaryStore.error"
      class="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-sm text-red-300"
    >
      {{ militaryStore.error }}
    </div>

    <!-- Loading -->
    <div
      v-if="militaryStore.loading && !militaryStore.hasUnits"
      class="text-center py-8"
    >
      <div class="animate-pulse text-red-700 text-sm">Sereg betöltése...</div>
    </div>

    <!-- Hatchery -->
    <Hatchery class="mb-6" />

    <!-- Unit groups -->
    <div
      v-for="group in militaryStore.unitsByType"
      :key="group.type"
      class="mb-4"
    >
      <MilitaryOverview
        :grouped-key="group.type"
        :batches="group.batches"
      />
    </div>

    <!-- Empty state -->
    <div
      v-if="!militaryStore.loading && !militaryStore.hasUnits"
      class="text-center py-12 text-zinc-600"
    >
      <div class="text-2xl mb-2">🥚</div>
      <div class="text-sm">Még nincs sereged. Keltess ki egységeket a Keltetőben!</div>
    </div>
  </div>
</template>
