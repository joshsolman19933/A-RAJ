<script setup lang="ts">
import { ref, computed } from 'vue';
import { queenService } from '@/services/queen.service';
import { useHiveStore } from '@/stores/hive.store';
import { useMilitaryStore } from '@/stores/military.store';
import {
  UnitType,
  UNIT_STATS,
  calculateTravelTime,
} from '@a-raj/shared';
import type { MapHexData } from '@a-raj/shared';

const props = defineProps<{
  target: MapHexData;
}>();

const emit = defineEmits<{
  close: [];
  launched: [swarmId: string];
}>();

const hiveStore = useHiveStore();
const militaryStore = useMilitaryStore();

// --- State ---
const loading = ref(false);
const error = ref<string | null>(null);
const swarmLaunched = ref(false);
const swarmId = ref<string | null>(null);

// --- Escort unit selection ---
interface EscortSelection {
  unitType: UnitType;
  count: number;
}

const escortSelections = ref<EscortSelection[]>(
  militaryStore.units
    .filter((u) => u.unitType !== UnitType.QUEEN)
    .map((u) => ({ unitType: u.unitType as UnitType, count: 0 })),
);

const totalEscortCount = computed(() =>
  escortSelections.value.reduce((s, e) => s + e.count, 0),
);

const hasEscort = computed(() => totalEscortCount.value > 0);

// --- Travel time ---
const travelHours = computed(() => {
  if (!hiveStore.hasHive) return 0;
  const speeds = escortSelections.value
    .filter((e) => e.count > 0)
    .map((e) => UNIT_STATS[e.unitType]?.speed ?? Infinity);
  const queenSpeed = UNIT_STATS[UnitType.QUEEN].speed;
  const slowest = Math.min(queenSpeed, ...speeds.length ? speeds : [Infinity]);
  if (!isFinite(slowest) || slowest <= 0) return 0;

  return calculateTravelTime(
    { q: hiveStore.hiveQ, r: hiveStore.hiveR },
    { q: props.target.q, r: props.target.r },
    slowest,
  );
});

const travelTimeFormatted = computed(() => {
  if (travelHours.value <= 0) return '—';
  const h = Math.floor(travelHours.value);
  const m = Math.floor((travelHours.value - h) * 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}n ${rh}ó ${m}p`;
  }
  if (h > 0) return `${h}ó ${m}p`;
  return `${m}p`;
});

// --- Available unit counts ---
function getAvailable(unitType: UnitType): number {
  const unit = militaryStore.unitsByType.find((u) => u.type === unitType);
  return unit?.count ?? 0;
}

function setMax(unitType: UnitType) {
  const sel = escortSelections.value.find((e) => e.unitType === unitType);
  if (!sel) return;
  sel.count = getAvailable(unitType);
}

function addEscort(unitType: UnitType) {
  const sel = escortSelections.value.find((e) => e.unitType === unitType);
  if (!sel) return;
  const avail = getAvailable(unitType);
  sel.count = Math.min(sel.count + 1, avail);
}

function removeEscort(unitType: UnitType) {
  const sel = escortSelections.value.find((e) => e.unitType === unitType);
  if (!sel) return;
  sel.count = Math.max(sel.count - 1, 0);
}

function unitName(unitType: UnitType): string {
  switch (unitType) {
    case UnitType.WORKER: return 'Dolgozó';
    case UnitType.BLOOD_TANK: return 'Vér-Páncélos';
    case UnitType.ACID_SPITTER: return 'Sav-Köpő';
    case UnitType.SCOUT_WASP: return 'Fürkészdarázs';
    default: return unitType;
  }
}

function unitIcon(unitType: UnitType): string {
  switch (unitType) {
    case UnitType.WORKER: return '🦗';
    case UnitType.BLOOD_TANK: return '🪳';
    case UnitType.ACID_SPITTER: return '🐛';
    case UnitType.SCOUT_WASP: return '🐝';
    default: return '⬡';
  }
}

// --- Launch swarm ---
async function launchSwarm() {
  loading.value = true;
  error.value = null;
  try {
    const escortUnits = escortSelections.value
      .filter((e) => e.count > 0)
      .map((e) => ({ unitType: e.unitType, count: e.count }));

    const res = await queenService.launchSwarm({
      targetQ: props.target.q,
      targetR: props.target.r,
      escortUnits,
    });

    swarmLaunched.value = true;
    swarmId.value = res.swarmId;
    emit('launched', res.swarmId);

    // Refresh hive and military data
    await hiveStore.fetchHive();
    await militaryStore.fetchUnits();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value = err?.response?.data?.message || 'Rajzás indítása sikertelen';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="fixed inset-0 z-30 flex items-end md:items-center justify-center">
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-black/60 backdrop-blur-sm"
      @click="emit('close')"
    />

    <!-- Panel -->
    <div class="relative w-full max-w-md mx-2 mb-20 md:mb-0 rounded-xl border border-red-950/40 bg-black/90 backdrop-blur-md shadow-2xl shadow-red-950/30 overflow-hidden">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-red-950/20 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-zinc-200">Rajzás Indítása</h3>
          <p class="text-xs text-zinc-500 mt-0.5">
            Cél: ({{ target.q }}, {{ target.r }})
          </p>
        </div>
        <button
          class="text-zinc-600 hover:text-zinc-400 transition-colors text-lg"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Body -->
      <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <!-- Launched success state -->
        <template v-if="swarmLaunched">
          <div class="p-3 rounded-lg border border-green-900/40 bg-green-950/20">
            <div class="flex items-center gap-2">
              <span class="text-green-500 text-2xl">&#9819;</span>
              <div>
                <div class="text-sm font-medium text-green-400">Rajzás elindult!</div>
                <div class="text-xs text-zinc-500 mt-0.5">
                  A Királynő és kísérő serege úton van
                </div>
                <div class="text-xs text-zinc-400 mt-1">
                  Érkezés: ~{{ travelTimeFormatted }} múlva
                </div>
              </div>
            </div>
          </div>
          <button
            class="w-full py-2 rounded-lg text-sm bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:text-zinc-300 transition-all"
            @click="emit('close')"
          >
            Rendben
          </button>
        </template>

        <!-- Normal state -->
        <template v-else>
          <!-- Warning -->
          <div class="p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/30 text-xs text-amber-400">
            &#9888; A rajzás alatt a kísérő sereg és a Királynő sebezhető! Támadás esetén a Királynő is elpusztulhat.
          </div>

          <!-- Error -->
          <div
            v-if="error"
            class="p-2.5 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-300"
          >
            {{ error }}
            <button class="ml-2 text-zinc-500 hover:text-zinc-300" @click="error = null">✕</button>
          </div>

          <!-- Escort unit selector -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-semibold text-zinc-400 tracking-wide uppercase">
                Kísérő Sereg
              </h4>
              <span class="text-xs text-zinc-600">
                {{ totalEscortCount }} egység kiválasztva
              </span>
            </div>

            <div class="space-y-1.5">
              <div
                v-for="sel in escortSelections"
                :key="sel.unitType"
                class="flex items-center gap-2 p-2 rounded-lg border"
                :class="sel.count > 0
                  ? 'border-red-900/30 bg-red-950/10'
                  : 'border-zinc-800 bg-zinc-900/20'"
              >
                <!-- Icon + name -->
                <span class="text-lg flex-shrink-0">{{ unitIcon(sel.unitType) }}</span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-zinc-300">{{ unitName(sel.unitType) }}</div>
                  <div class="text-[11px] text-zinc-600">
                    Sebesség: {{ UNIT_STATS[sel.unitType].speed }} mező/óra · Elérhető: {{ getAvailable(sel.unitType) }}
                  </div>
                </div>

                <!-- Counter -->
                <div class="flex items-center gap-1">
                  <button
                    class="w-6 h-6 flex items-center justify-center rounded text-xs bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                    :disabled="sel.count <= 0 || loading"
                    @click="removeEscort(sel.unitType)"
                  >
                    −
                  </button>
                  <span
                    class="w-8 text-center text-sm font-mono"
                    :class="sel.count > 0 ? 'text-red-400' : 'text-zinc-600'"
                  >
                    {{ sel.count }}
                  </span>
                  <button
                    class="w-6 h-6 flex items-center justify-center rounded text-xs bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                    :disabled="sel.count >= getAvailable(sel.unitType) || loading"
                    @click="addEscort(sel.unitType)"
                  >
                    +
                  </button>
                  <button
                    class="ml-0.5 px-1 py-0.5 rounded text-[9px] bg-zinc-900/30 border border-zinc-800 text-zinc-600 hover:text-zinc-400 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                    :disabled="getAvailable(sel.unitType) <= 0 || loading"
                    @click="setMax(sel.unitType)"
                  >
                    max
                  </button>
                </div>
              </div>
            </div>

            <div
              v-if="militaryStore.units.length === 0"
              class="text-center py-4 text-xs text-zinc-600 italic"
            >
              Nincsenek elérhető egységeid. Keltess ki egységeket előbb!
            </div>
          </div>

          <!-- Travel estimate -->
          <div
            v-if="hasEscort"
            class="p-2.5 rounded-lg bg-zinc-900/30 border border-zinc-800"
          >
            <div class="flex items-center justify-between text-xs">
              <span class="text-zinc-500">Becsült utazási idő</span>
              <span class="text-red-400 font-mono">{{ travelTimeFormatted }}</span>
            </div>
            <div class="flex items-center justify-between text-[11px] mt-1">
              <span class="text-zinc-600">Távolság a kaptártól</span>
              <span class="text-zinc-400">
                ({{ hiveStore.hiveQ }}, {{ hiveStore.hiveR }}) → ({{ target.q }}, {{ target.r }})
              </span>
            </div>
          </div>

          <!-- Launch button -->
          <button
            class="w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            :class="hasEscort && !loading
              ? 'bg-red-900/50 hover:bg-red-800 text-red-300 border border-red-700/30'
              : 'bg-zinc-900/50 text-zinc-600 border border-zinc-800'"
            :disabled="!hasEscort || loading"
            @click="launchSwarm"
          >
            <template v-if="loading">
              <span class="animate-pulse">Rajzás indítása...</span>
            </template>
            <template v-else>
              &#9819; Rajzás Indítása
            </template>
          </button>

          <button
            class="w-full py-2 rounded-lg text-xs bg-zinc-900/30 border border-zinc-800 text-zinc-500 hover:text-zinc-400 transition-all"
            @click="emit('close')"
          >
            Mégse
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
