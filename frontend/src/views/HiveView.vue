<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useHiveStore } from '@/stores/hive.store';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'vue-router';
import { ChamberType, CHAMBER_DEFINITIONS } from '@a-raj/shared';
import type { ChamberData } from '@a-raj/shared';
import ResourceBar from '@/components/hive/ResourceBar.vue';
import ChamberCard from '@/components/hive/ChamberCard.vue';
import BuildQueue from '@/components/hive/BuildQueue.vue';

const store = useHiveStore();
const auth = useAuthStore();
const router = useRouter();

if (!auth.isLoggedIn) {
  router.push('/login');
}

const buildMenuOpen = ref(false);

// Available chamber types for new construction (exclude already built)
const buildableChambers = ref<ChamberType[]>([]);

function updateBuildableChambers() {
  const builtTypes = new Set(store.chambers.map((c) => c.type));
  buildableChambers.value = Object.values(ChamberType).filter(
    (t) => !builtTypes.has(t),
  );
}

// Auto-refresh interval (every 30 seconds)
let refreshTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await store.fetchHive();
  updateBuildableChambers();

  // Auto-refresh every 30 seconds to sync with server
  refreshTimer = setInterval(async () => {
    await store.fetchHive();
    updateBuildableChambers();
  }, 30000);
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});

async function onChamberUpgraded() {
  updateBuildableChambers();
}

async function buildNewChamber(chamberType: ChamberType) {
  try {
    await store.upgradeChamber(chamberType);
    buildMenuOpen.value = false;
    updateBuildableChambers();
  } catch {
    // Error handled by store
  }
}

function sortChambers(chambers: ChamberData[]): ChamberData[] {
  const order = [
    ChamberType.QUEEN,
    ChamberType.MUSHROOM_GARDEN,
    ChamberType.ROOT_SIPHON,
    ChamberType.HEAT_CHAMBER,
    ChamberType.DIGESTIVE_PIT,
    ChamberType.HATCHERY,
    ChamberType.ACID_GLAND,
    ChamberType.PHEROMONE_GLAND,
  ];
  return [...chambers].sort(
    (a, b) => order.indexOf(a.type as ChamberType) - order.indexOf(b.type as ChamberType),
  );
}
</script>

<template>
  <div class="p-4 max-w-2xl mx-auto pb-20 md:pb-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-2xl font-bold text-red-500">
          &#9763; Kaptárad
        </h1>
        <p class="text-xs text-zinc-600 mt-0.5">
          Koordináták: ({{ store.hiveQ }}, {{ store.hiveR }})
        </p>
      </div>
      <button
        v-if="buildableChambers.length > 0"
        class="px-4 py-2 text-sm font-semibold bg-red-900/50 hover:bg-red-800 text-red-300 rounded-lg transition-all"
        @click="buildMenuOpen = !buildMenuOpen"
      >
        {{ buildMenuOpen ? 'Mégse' : '+ Új Kamra' }}
      </button>
    </div>

    <!-- Error banner -->
    <div
      v-if="store.error"
      class="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-sm text-red-300"
    >
      {{ store.error }}
    </div>

    <!-- Build new chamber menu -->
    <div
      v-if="buildMenuOpen"
      class="mb-4 p-4 border border-red-950/40 rounded-lg bg-black/60"
    >
      <h3 class="text-sm font-semibold text-zinc-300 mb-3">
        Új kamra építése
      </h3>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="type in buildableChambers"
          :key="type"
          :disabled="store.loading"
          class="text-left p-2 rounded border border-red-950/30 bg-black/40 hover:bg-red-950/20 disabled:opacity-50 transition-all"
          @click="buildNewChamber(type)"
        >
          <div class="text-sm font-medium text-zinc-300">
            {{ CHAMBER_DEFINITIONS[type].name }}
          </div>
          <div class="text-xs text-zinc-600 mt-0.5">
            {{ CHAMBER_DEFINITIONS[type].description }}
          </div>
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div
      v-if="store.loading && !store.hasHive"
      class="text-center py-12"
    >
      <div class="animate-pulse text-red-700 text-lg">
        Kaptár betöltése...
      </div>
    </div>

    <!-- Main hive content -->
    <template v-else>
      <!-- Resources -->
      <ResourceBar class="mb-6" />

      <!-- Build Queue -->
      <BuildQueue class="mb-6" />

      <!-- Chambers -->
      <div class="mb-4">
        <h2 class="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
          <span>Kamrák</span>
          <span class="text-xs text-zinc-600">({{ store.chambers.length }})</span>
        </h2>
        <div class="grid gap-3">
          <ChamberCard
            v-for="chamber in sortChambers(store.chambers)"
            :key="chamber.id"
            :chamber="chamber"
            @upgraded="onChamberUpgraded"
          />
        </div>
      </div>

      <!-- No chambers edge case -->
      <div
        v-if="store.chambers.length === 0"
        class="text-center py-8 text-zinc-600 text-sm italic"
      >
        Még nincsenek kamráid. Építs egyet a "+ Új Kamra" gombbal!
      </div>
    </template>
  </div>
</template>
