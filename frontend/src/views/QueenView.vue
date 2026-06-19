<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useHiveStore } from '@/stores/hive.store';
import { useMilitaryStore } from '@/stores/military.store';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'vue-router';
import { queenService } from '@/services/queen.service';
import { AttackType, UnitType } from '@a-raj/shared';
import type { MovementData } from '@a-raj/shared';
import HiveSwitcher from '@/components/queen/HiveSwitcher.vue';
import QueenTrainingPanel from '@/components/queen/QueenTrainingPanel.vue';

const hiveStore = useHiveStore();
const militaryStore = useMilitaryStore();
const auth = useAuthStore();
const router = useRouter();

if (!auth.isLoggedIn) {
  router.push('/login');
}

// --- Swarm status tracking ---
const swarmLoading = ref(false);
const swarmError = ref<string | null>(null);
const activeSwarms = ref<MovementData[]>([]);
const now = ref(Date.now());

let statusTimer: ReturnType<typeof setInterval> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  // Fetch multi-hive data
  await hiveStore.fetchHives();
  if (hiveStore.hasHive) {
    await hiveStore.fetchHive();
    await militaryStore.fetchUnits();
  }
  await fetchSwarmStatus();

  // Poll swarm status every 30s
  statusTimer = setInterval(fetchSwarmStatus, 30000);
  clockTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (statusTimer) clearInterval(statusTimer);
  if (clockTimer) clearInterval(clockTimer);
});

async function fetchSwarmStatus() {
  if (!hiveStore.hasHive) return;
  swarmLoading.value = true;
  swarmError.value = null;
  try {
    const res = await queenService.getSwarmStatus();
    activeSwarms.value = res.movements;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    swarmError.value = err?.response?.data?.message ?? null;
  } finally {
    swarmLoading.value = false;
  }
}

// --- Computed ---

const hasActiveSwarm = computed(() => activeSwarms.value.length > 0);

function swarmRemainingMs(swarm: MovementData): number {
  return Math.max(0, new Date(swarm.arriveAt).getTime() - now.value);
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Megérkezett!';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}n ${rh}ó ${m}p`;
  }
  if (h > 0) return `${h}ó ${m}p ${s}mp`;
  if (m > 0) return `${m}p ${s}mp`;
  return `${s}mp`;
}

function unitTypeLabel(type: string): string {
  switch (type) {
    case UnitType.QUEEN: return '&#9819; Királynő';
    case UnitType.WORKER: return '&#129439; Dolgozó';
    case UnitType.BLOOD_TANK: return '&#129715; Vér-Páncélos';
    case UnitType.ACID_SPITTER: return '&#128027; Sav-Köpő';
    case UnitType.SCOUT_WASP: return '&#128029; Fürkészdarázs';
    default: return type;
  }
}
</script>

<template>
  <div class="p-4 max-w-2xl mx-auto pb-20 md:pb-4 space-y-4">
    <!-- Header with HiveSwitcher -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-red-500">
          &#9819; Rajzás
        </h1>
        <p class="text-xs text-zinc-600 mt-0.5">
          Királynő képzés és új kaptár alapítása
        </p>
      </div>
      <HiveSwitcher />
    </div>

    <!-- Loading state -->
    <div
      v-if="hiveStore.loading && !hiveStore.hasHive"
      class="text-center py-12"
    >
      <div class="animate-pulse text-red-700 text-lg">
        Kaptár betöltése...
      </div>
    </div>

    <!-- No hive -->
    <div
      v-else-if="!hiveStore.hasHive"
      class="text-center py-12"
    >
      <div class="text-zinc-600 text-sm italic">
        Nincs kaptárad. Hozz létre egyet először!
      </div>
      <router-link
        to="/hive"
        class="inline-block mt-3 px-4 py-2 rounded-lg text-sm bg-red-900/30 border border-red-700/30 text-red-400 hover:bg-red-900/50 transition-all"
      >
        Ugrás a Kaptárhoz
      </router-link>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Error banner -->
      <div
        v-if="swarmError"
        class="p-3 bg-red-950/50 border border-red-800 rounded-lg text-sm text-red-300 flex items-center justify-between"
      >
        <span>{{ swarmError }}</span>
        <button class="text-zinc-500 hover:text-zinc-300" @click="swarmError = null">✕</button>
      </div>

      <!-- Queen Training Panel -->
      <QueenTrainingPanel />

      <!-- Active Swarm Status -->
      <div class="rounded-xl border border-red-950/30 bg-black/60 overflow-hidden">
        <div class="px-4 py-3 border-b border-red-950/20 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-amber-500 text-lg">&#8982;</span>
            <h3 class="text-sm font-semibold text-zinc-200">Aktív Rajzások</h3>
          </div>
          <button
            class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            @click="fetchSwarmStatus"
          >
            Frissítés
          </button>
        </div>

        <div class="p-4">
          <!-- Loading -->
          <div
            v-if="swarmLoading && !hasActiveSwarm"
            class="text-center py-4"
          >
            <div class="animate-pulse text-zinc-600 text-sm">Betöltés...</div>
          </div>

          <!-- No active swarms -->
          <div
            v-else-if="!hasActiveSwarm"
            class="text-center py-6"
          >
            <div class="text-zinc-600 text-sm">Nincsenek aktív rajzások</div>
            <p class="text-xs text-zinc-700 mt-1">
              Képezz ki egy Királynőt, majd indítsd el a rajzást a térképről!
            </p>
          </div>

          <!-- Swarm list -->
          <div
            v-else
            class="space-y-3"
          >
            <div
              v-for="swarm in activeSwarms"
              :key="swarm.id"
              class="p-3 rounded-lg border border-red-950/20 bg-zinc-900/20"
            >
              <!-- Header row -->
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="text-red-500">&#9819;</span>
                  <div>
                    <div class="text-xs font-medium text-zinc-300">
                      Rajzás → ({{ swarm.targetQ }}, {{ swarm.targetR }})
                    </div>
                    <div class="text-[11px] text-zinc-600">
                      Indítva: {{ new Date(swarm.sentAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) }}
                    </div>
                  </div>
                </div>
                <span
                  class="text-xs font-mono px-2 py-0.5 rounded-full"
                  :class="swarmRemainingMs(swarm) > 0
                    ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30'
                    : 'bg-green-950/40 text-green-400 border border-green-900/30'"
                >
                  {{ formatRemaining(swarmRemainingMs(swarm)) }}
                </span>
              </div>

              <!-- Progress bar -->
              <div class="mb-2">
                <div class="h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-red-950/10">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-amber-800 to-amber-600 transition-all duration-1000"
                    :style="{
                      width: Math.min(100, Math.max(0,
                        (1 - swarmRemainingMs(swarm) / (new Date(swarm.arriveAt).getTime() - new Date(swarm.sentAt).getTime())) * 100
                      )) + '%'
                    }"
                  />
                </div>
              </div>

              <!-- Units in transit -->
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="(u, i) in swarm.units"
                  :key="i"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900/40 border border-zinc-800 text-zinc-500"
                >
                  <span v-html="unitTypeLabel(u.unitType)" /> ×{{ u.count }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation hint -->
      <div class="text-center text-xs text-zinc-700 pb-4">
        A célpont kiválasztásához nyisd meg a <router-link to="/map" class="text-red-700 hover:text-red-500 underline">Térképet</router-link> és kattints egy üres hexára!
      </div>
    </template>
  </div>
</template>
