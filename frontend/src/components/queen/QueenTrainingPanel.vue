<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { queenService } from '@/services/queen.service';
import { useHiveStore } from '@/stores/hive.store';
import { useAuthStore } from '@/stores/auth.store';
import {
  QueenTrainingStatus,
  UnitType,
  UNIT_STATS,
  QUEEN_DNA_NECTAR_COST,
  QUEEN_MIN_HATCHERY_LEVEL,
  ChamberType,
} from '@a-raj/shared';
import type { QueenTrainingData, ChamberData } from '@a-raj/shared';

const hiveStore = useHiveStore();
const auth = useAuthStore();

// --- State ---
const loading = ref(false);
const error = ref<string | null>(null);
const trainingStatus = ref<QueenTrainingData | null>(null);
const now = ref(Date.now());

// --- Timer ---
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await fetchStatus();
  timer = setInterval(() => {
    now.value = Date.now();
  }, 30000); // Update every 30s (8-hour training doesn't need second precision)
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

// --- Computed ---

const queenStats = UNIT_STATS[UnitType.QUEEN];

const hasHatchery = computed(() =>
  hiveStore.chambers.some((c: ChamberData) => c.type === ChamberType.HATCHERY),
);

const hatcheryLevel = computed(() => {
  const chamber = hiveStore.chambers.find((c: ChamberData) => c.type === ChamberType.HATCHERY);
  return chamber?.level ?? 0;
});

const hatcheryTooLow = computed(
  () => hatcheryLevel.value < QUEEN_MIN_HATCHERY_LEVEL,
);

const canTrain = computed(() => {
  if (loading.value) return false;
  if (!hiveStore.hasHive) return false;
  if (!hasHatchery.value) return false;
  if (hatcheryTooLow.value) return false;
  if (trainingStatus.value?.status === QueenTrainingStatus.TRAINING) return false;
  if (hiveStore.resources.dnaNectar < QUEEN_DNA_NECTAR_COST) return false;
  if (hiveStore.resources.biomass < queenStats.biomassCost) return false;
  if (hiveStore.resources.water < queenStats.waterCost) return false;
  if (hiveStore.resources.heat < queenStats.heatCost) return false;
  return true;
});

const isTraining = computed(
  () => trainingStatus.value?.status === QueenTrainingStatus.TRAINING,
);

const isReady = computed(
  () => trainingStatus.value?.status === QueenTrainingStatus.READY,
);

const completesAt = computed(() => {
  if (!trainingStatus.value?.completesAt) return null;
  return new Date(trainingStatus.value.completesAt);
});

const remainingMs = computed(() => {
  if (!completesAt.value) return 0;
  return Math.max(0, completesAt.value.getTime() - now.value);
});

const remainingText = computed(() => {
  const ms = remainingMs.value;
  if (ms <= 0) return 'Befejeződött!';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}ó ${m}p ${s}mp`;
  if (m > 0) return `${m}p ${s}mp`;
  return `${s}mp`;
});

const progressPercent = computed(() => {
  if (!trainingStatus.value) return 0;
  const start = new Date(trainingStatus.value.startedAt).getTime();
  const end = new Date(trainingStatus.value.completesAt).getTime();
  const total = end - start;
  if (total <= 0) return 100;
  const elapsed = now.value - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
});

const missingResources = computed(() => {
  const missing: string[] = [];
  if (hiveStore.resources.dnaNectar < QUEEN_DNA_NECTAR_COST) {
    missing.push(`${QUEEN_DNA_NECTAR_COST} DNS Nektár (jelenleg: ${Math.floor(hiveStore.resources.dnaNectar)})`);
  }
  if (hiveStore.resources.biomass < queenStats.biomassCost) {
    missing.push(`${queenStats.biomassCost} Biomassza (jelenleg: ${Math.floor(hiveStore.resources.biomass)})`);
  }
  if (hiveStore.resources.water < queenStats.waterCost) {
    missing.push(`${queenStats.waterCost} Víz (jelenleg: ${Math.floor(hiveStore.resources.water)})`);
  }
  if (hiveStore.resources.heat < queenStats.heatCost) {
    missing.push(`${queenStats.heatCost} Hő (jelenleg: ${Math.floor(hiveStore.resources.heat)})`);
  }
  return missing;
});

// --- Actions ---

async function fetchStatus() {
  try {
    const res = await queenService.getQueenStatus();
    trainingStatus.value = res.status;
  } catch {
    // Silently fail — status poll is auxiliary
  }
}

async function startTraining() {
  loading.value = true;
  error.value = null;
  try {
    const res = await queenService.trainQueen();
    trainingStatus.value = res;
    // Update hive resources after training starts
    await hiveStore.fetchHive();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value = err?.response?.data?.message || 'Képzés indítása sikertelen';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="rounded-xl border border-red-950/30 bg-black/60 overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-red-950/20 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-red-500 text-xl leading-none">&#9819;</span>
        <h3 class="text-sm font-semibold text-zinc-200">Királynő Képzés</h3>
      </div>
      <button
        v-if="!isTraining"
        class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        @click="fetchStatus"
      >
        Frissítés
      </button>
    </div>

    <!-- Body -->
    <div class="p-4 space-y-3">
      <!-- Loading -->
      <div
        v-if="loading"
        class="text-center py-4"
      >
        <div class="animate-pulse text-red-700 text-sm">Képzés indítása...</div>
      </div>

      <!-- Error -->
      <div
        v-if="error"
        class="p-2.5 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-300"
      >
        {{ error }}
        <button class="ml-2 text-zinc-500 hover:text-zinc-300" @click="error = null">✕</button>
      </div>

      <!-- TRAINING state -->
      <template v-if="isTraining">
        <!-- Progress bar -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="text-zinc-500">Képzés folyamatban</span>
            <span class="text-red-400 font-mono">{{ remainingText }}</span>
          </div>
          <div class="h-2 rounded-full bg-zinc-900 overflow-hidden border border-red-950/20">
            <div
              class="h-full rounded-full bg-gradient-to-r from-red-900 to-red-600 transition-all duration-1000"
              :style="{ width: progressPercent + '%' }"
            />
          </div>
          <div class="flex items-center justify-between text-[11px] text-zinc-600">
            <span>{{ progressPercent.toFixed(0) }}% kész</span>
            <span v-if="completesAt">
              Kész: {{ completesAt.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) }}
            </span>
          </div>
        </div>

        <!-- Training info -->
        <div class="flex gap-2 text-xs text-zinc-600">
          <div class="flex items-center gap-1">
            <span class="text-red-700">&#9819;</span>
            <span>1 Királynő</span>
          </div>
          <span>·</span>
          <span>{{ queenStats.hatchTimeMinutes }} perc</span>
        </div>
      </template>

      <!-- READY state -->
      <template v-else-if="isReady">
        <div class="p-3 rounded-lg border border-green-900/40 bg-green-950/20">
          <div class="flex items-center gap-2">
            <span class="text-green-500 text-xl">&#9819;</span>
            <div>
              <div class="text-sm font-medium text-green-400">Királynő készen áll!</div>
              <div class="text-xs text-zinc-500 mt-0.5">
                Indítsd el a rajzást egy üres hexára a térképen
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- No training + can train -->
      <template v-else>
        <!-- Requirements -->
        <div class="space-y-2">
          <!-- Hatchery requirement -->
          <div
            class="flex items-center justify-between text-xs"
            :class="hatcheryTooLow ? 'text-red-400' : 'text-zinc-500'"
          >
            <span>
              {{ hasHatchery ? `Keltető ${hatcheryLevel}. szint` : 'Keltető szükséges' }}
            </span>
            <span v-if="hatcheryTooLow">
              (minimum {{ QUEEN_MIN_HATCHERY_LEVEL }}. szint)
            </span>
            <span v-else-if="hasHatchery" class="text-green-500">✓</span>
          </div>

          <!-- Resource costs -->
          <div class="grid grid-cols-2 gap-1.5 text-xs">
            <div class="flex items-center justify-between p-1.5 rounded bg-zinc-900/50">
              <span class="text-zinc-500">&#9679; Biomassza</span>
              <span
                :class="hiveStore.resources.biomass >= queenStats.biomassCost ? 'text-green-400' : 'text-red-400'"
              >
                {{ Math.floor(hiveStore.resources.biomass) }} / {{ queenStats.biomassCost }}
              </span>
            </div>
            <div class="flex items-center justify-between p-1.5 rounded bg-zinc-900/50">
              <span class="text-zinc-500">&#9830; Víz</span>
              <span
                :class="hiveStore.resources.water >= queenStats.waterCost ? 'text-green-400' : 'text-red-400'"
              >
                {{ Math.floor(hiveStore.resources.water) }} / {{ queenStats.waterCost }}
              </span>
            </div>
            <div class="flex items-center justify-between p-1.5 rounded bg-zinc-900/50">
              <span class="text-zinc-500">&#9889; Hő</span>
              <span
                :class="hiveStore.resources.heat >= queenStats.heatCost ? 'text-green-400' : 'text-red-400'"
              >
                {{ Math.floor(hiveStore.resources.heat) }} / {{ queenStats.heatCost }}
              </span>
            </div>
            <div class="flex items-center justify-between p-1.5 rounded bg-zinc-900/50">
              <span class="text-zinc-500">&#10022; DNS Nektár</span>
              <span
                :class="hiveStore.resources.dnaNectar >= QUEEN_DNA_NECTAR_COST ? 'text-purple-400' : 'text-red-400'"
              >
                {{ Math.floor(hiveStore.resources.dnaNectar) }} / {{ QUEEN_DNA_NECTAR_COST }}
              </span>
            </div>
          </div>

          <!-- Missing resources list -->
          <div
            v-if="missingResources.length > 0 && !loading"
            class="space-y-0.5"
          >
            <div
              v-for="msg in missingResources"
              :key="msg"
              class="text-[11px] text-red-400/80"
            >
              Hiányzik: {{ msg }}
            </div>
          </div>

          <!-- Pre-requisite warning -->
          <div
            v-if="!hasHatchery || hatcheryTooLow"
            class="p-2 rounded-lg bg-amber-950/30 border border-amber-900/30 text-xs text-amber-400"
          >
            {{ !hasHatchery
              ? 'Építs egy Keltetőt a Királynő képzéshez!'
              : `A Keltetőnek legalább ${QUEEN_MIN_HATCHERY_LEVEL}. szintűnek kell lennie!`
            }}
          </div>
        </div>

        <!-- Train button -->
        <button
          class="w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          :class="canTrain
            ? 'bg-red-900/50 hover:bg-red-800 text-red-300 border border-red-700/30 cursor-pointer'
            : 'bg-zinc-900/50 text-zinc-600 border border-zinc-800 cursor-not-allowed'"
          :disabled="!canTrain || loading"
          @click="startTraining"
        >
          <template v-if="loading">
            <span class="animate-pulse">Képzés indítása...</span>
          </template>
          <template v-else>
            &#9819; Új Királynő képzése
          </template>
        </button>

        <!-- Duration hint -->
        <div class="text-center text-[11px] text-zinc-600">
          Képzési idő: {{ queenStats.hatchTimeMinutes }} perc (8 óra)
        </div>
      </template>
    </div>
  </div>
</template>
