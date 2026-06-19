<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useMilitaryStore } from '@/stores/military.store';
import { useMovementStore } from '@/stores/movement.store';
import { useHiveStore } from '@/stores/hive.store';
import { UNIT_STATS, AttackType, UnitType, hexDistance } from '@a-raj/shared';
import type { UnitBatchBrief, MapHexData } from '@a-raj/shared';
import { getUnitName } from '@/lib/unit-labels';

const props = defineProps<{
  target: MapHexData | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const militaryStore = useMilitaryStore();
const movementStore = useMovementStore();
const hiveStore = useHiveStore();

const attackType = ref<string>(AttackType.RAID);

const unitCounts = ref<Record<string, number>>({});

// Reset unit selection when target changes
watch(
  () => props.target,
  () => {
    unitCounts.value = {};
  },
);

const availableUnits = computed(() => militaryStore.units);

const maxCount = (unitType: string): number => {
  const batch = militaryStore.units.find((u) => u.unitType === unitType);
  return batch?.count ?? 0;
};

const selectedUnits = computed<UnitBatchBrief[]>(() => {
  return Object.entries(unitCounts.value)
    .filter(([, count]) => count > 0)
    .map(([unitType, count]) => ({
      unitType: unitType as UnitType,
      count,
    }));
});

const totalSelected = computed(() =>
  selectedUnits.value.reduce((s, u) => s + u.count, 0),
);

// Travel time estimate
const travelHours = computed(() => {
  if (!props.target || !selectedUnits.value.length || !hiveStore.hasHive) return null;
  const speeds = selectedUnits.value.map(
    (u) => UNIT_STATS[u.unitType]?.speed ?? Infinity,
  );
  const slowest = Math.min(...speeds);
  if (slowest <= 0) return null;

  const dist = hexDistance(
    { q: hiveStore.hiveQ, r: hiveStore.hiveR },
    { q: props.target.q, r: props.target.r },
  );
  return (dist / slowest).toFixed(1);
});

const canSend = computed(
  () =>
    selectedUnits.value.length > 0 &&
    props.target !== null &&
    !movementStore.loading,
);

const sending = ref(false);

async function doSend() {
  if (!props.target) return;
  sending.value = true;
  try {
    await movementStore.sendAttack({
      attackType: attackType.value,
      targetQ: props.target.q,
      targetR: props.target.r,
      units: selectedUnits.value,
    });
    emit('close');
  } catch {
    // Error handled by store
  } finally {
    sending.value = false;
  }
}

const targetLabel = computed(() => {
  if (!props.target) return '';
  if (props.target.type === 'HIVE') {
    return `🏠 ${props.target.hiveName || 'Ellenséges kaptár'}`;
  }
  if (props.target.type === 'PVE_NEST') {
    return '👾 PvE Fészek';
  }
  return '';
});

const unitName = (type: string): string => getUnitName(type);

const unitNameShort = (type: string): string => {
  const map: Record<string, string> = {
    WORKER: 'Dolgozó',
    BLOOD_TANK: 'Vér-Páncélos',
    ACID_SPITTER: 'Sav-Köpő',
    SCOUT_WASP: 'Fürkészdarázs',
  };
  return map[type] ?? type;
};

const attackTypeLabel = (type: string): string =>
  type === AttackType.RAID ? '🗡️ Rablóhadjárat' : '💣 Ostrom';

const attackTypeDesc = (type: string): string =>
  type === AttackType.RAID
    ? 'Nyersanyag lopás a célponttól'
    : 'Kamrák rombolása a célpontban';
</script>

<template>
  <Teleport to="body">
    <Transition name="panel">
      <div
        v-if="target"
        class="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="$emit('close')"
        />

        <!-- Panel -->
        <div
          class="relative w-full md:max-w-md max-h-[80vh] overflow-y-auto rounded-t-2xl md:rounded-2xl border border-red-950/40 bg-black/95 p-5 shadow-2xl"
        >
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="text-lg font-bold text-red-400">Támadás indítása</div>
              <div class="text-sm text-zinc-400 mt-0.5">{{ targetLabel }}</div>
              <div class="text-xs text-zinc-600">
                ({{ target.q }}, {{ target.r }})
              </div>
            </div>
            <button
              class="text-zinc-600 hover:text-zinc-400 text-xl"
              @click="$emit('close')"
            >
              ✕
            </button>
          </div>

          <!-- Error -->
          <div
            v-if="movementStore.error"
            class="mb-3 p-2 rounded bg-red-950/50 border border-red-800 text-sm text-red-300"
          >
            {{ movementStore.error }}
          </div>

          <!-- Attack type selector -->
          <div class="mb-4">
            <div class="text-xs text-zinc-500 mb-2">Támadás típusa</div>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="type in [AttackType.RAID, AttackType.SIEGE]"
                :key="type"
                class="p-3 rounded-lg border text-left transition-all"
                :class="
                  attackType === type
                    ? 'border-red-600/50 bg-red-950/30 text-red-300'
                    : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-red-900/30'
                "
                @click="attackType = type"
              >
                <div class="text-sm font-medium">{{ attackTypeLabel(type) }}</div>
                <div class="text-xs opacity-60 mt-0.5">
                  {{ attackTypeDesc(type) }}
                </div>
              </button>
            </div>
          </div>

          <!-- Unit selectors -->
          <div class="mb-4">
            <div class="text-xs text-zinc-500 mb-2">
              Egységek kiválasztása
            </div>

            <div v-if="!availableUnits.length" class="text-sm text-zinc-600 py-4 text-center">
              🥚 Nincs elérhető egységed. Keltess ki egységeket a Keltetőben!
            </div>

            <div
              v-for="unit in availableUnits"
              :key="unit.unitType"
              class="flex items-center gap-3 py-2 border-b border-zinc-900 last:border-0"
            >
              <div class="flex-1 min-w-0">
                <div class="text-sm text-zinc-300 truncate">
                  {{ unitName(unit.unitType) }}
                </div>
                <div class="text-xs text-zinc-600">
                  Elérhető: {{ unit.count }}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  :min="0"
                  :max="maxCount(unit.unitType)"
                  :value="unitCounts[unit.unitType] ?? 0"
                  class="w-20 h-1 accent-red-600"
                  @input="
                    (e) => {
                      const val = parseInt((e.target as HTMLInputElement).value);
                      unitCounts = { ...unitCounts, [unit.unitType]: val };
                    }
                  "
                />
                <span class="text-xs font-mono text-zinc-400 w-8 text-right">
                  {{ unitCounts[unit.unitType] ?? 0 }}
                </span>
              </div>
            </div>
          </div>

          <!-- Selected summary -->
          <div
            v-if="selectedUnits.length"
            class="mb-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800"
          >
            <div class="text-xs text-zinc-500 mb-1">Küldött egységek</div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="u in selectedUnits"
                :key="u.unitType"
                class="text-xs px-2 py-0.5 rounded bg-red-950/40 border border-red-900/30 text-red-300"
              >
                {{ unitName(u.unitType) }} ×{{ u.count }}
              </span>
            </div>
            <div class="text-xs text-zinc-600 mt-1.5">
              Összesen: {{ totalSelected }} egység
              <span v-if="travelHours" class="ml-2">
                | Utazás: ~{{ travelHours }} óra
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <button
              class="flex-1 py-2 rounded-lg text-sm border border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
              @click="$emit('close')"
            >
              Mégse
            </button>
            <button
              class="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              :class="
                canSend
                  ? 'bg-red-900/50 border border-red-700/40 text-red-300 hover:bg-red-900/70'
                  : 'bg-zinc-900/30 border border-zinc-800 text-zinc-600 cursor-not-allowed'
              "
              :disabled="!canSend || sending"
              @click="doSend()"
            >
              <span v-if="sending" class="animate-pulse">Támadás...</span>
              <span v-else>⚔️ Támadás indítása</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.panel-enter-active {
  transition: all 0.3s ease-out;
}
.panel-leave-active {
  transition: all 0.2s ease-in;
}
.panel-enter-from {
  opacity: 0;
  transform: translateY(100%);
}
.panel-leave-to {
  opacity: 0;
  transform: translateY(20%);
}
@media (min-width: 768px) {
  .panel-enter-from {
    transform: scale(0.95) translateY(0);
  }
  .panel-leave-to {
    transform: scale(0.95);
  }
}
</style>
