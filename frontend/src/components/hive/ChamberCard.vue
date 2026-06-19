<script setup lang="ts">
import { computed, ref } from 'vue';
import { useHiveStore } from '@/stores/hive.store';
import { ChamberType, CHAMBER_DEFINITIONS, calculateBuildCost } from '@a-raj/shared';
import type { ChamberData, ChamberDefinition } from '@a-raj/shared';

const props = defineProps<{
  chamber: ChamberData;
}>();

const emit = defineEmits<{
  upgraded: [chamber: ChamberData];
}>();

const store = useHiveStore();
const building = ref(false);
const buildError = ref<string | null>(null);

const def = computed<ChamberDefinition | null>(() => {
  return CHAMBER_DEFINITIONS[props.chamber.type] ?? null;
});

const isQueen = computed(() => props.chamber.type === ChamberType.QUEEN);
const nextLevel = computed(() => props.chamber.level + 1);
const isMaxLevel = computed(() => nextLevel.value > (def.value?.maxLevel ?? 99));

const stats = computed(() => {
  if (!def.value) return [];
  const s: { label: string; value: string }[] = [];
  const lv = props.chamber.level;
  const nl = nextLevel.value;

  switch (props.chamber.type) {
    case ChamberType.MUSHROOM_GARDEN:
      s.push({ label: 'Termelés', value: `${(def.value.biomassPerHourPerLevel ?? 0) * lv} Biomassza/ó` });
      if (!isMaxLevel.value)
        s.push({ label: 'Következő szint', value: `${(def.value.biomassPerHourPerLevel ?? 0) * nl} Biomassza/ó` });
      break;
    case ChamberType.ROOT_SIPHON:
      s.push({ label: 'Termelés', value: `${(def.value.waterPerHourPerLevel ?? 0) * lv} Víz/ó` });
      if (!isMaxLevel.value)
        s.push({ label: 'Következő szint', value: `${(def.value.waterPerHourPerLevel ?? 0) * nl} Víz/ó` });
      break;
    case ChamberType.HEAT_CHAMBER:
      s.push({ label: 'Termelés', value: `${(def.value.heatPerHourPerLevel ?? 0) * lv} Hő/ó` });
      if (!isMaxLevel.value)
        s.push({ label: 'Következő szint', value: `${(def.value.heatPerHourPerLevel ?? 0) * nl} Hő/ó` });
      break;
    case ChamberType.DIGESTIVE_PIT:
      s.push({ label: 'Tárkapacitás', value: `${500 + (def.value.storagePerLevel ?? 1000) * lv}` });
      if (!isMaxLevel.value)
        s.push({ label: 'Következő szint', value: `${500 + (def.value.storagePerLevel ?? 1000) * nl}` });
      break;
    case ChamberType.ACID_GLAND:
      s.push({ label: 'Védelem', value: `${(def.value.defensePerLevel ?? 50) * lv}` });
      if (!isMaxLevel.value)
        s.push({ label: 'Következő szint', value: `${(def.value.defensePerLevel ?? 50) * nl}` });
      break;
    case ChamberType.QUEEN:
      s.push({ label: 'Hőfogyasztás', value: `-${lv * 2} Hő/ó` });
      break;
    case ChamberType.HATCHERY:
      s.push({ label: 'Keltetési sebesség', value: `${Math.round((1 - Math.pow(def.value.hatcherySpeedPerLevel ?? 0.9, lv)) * 100)}%` });
      if (!isMaxLevel.value)
        s.push({ label: 'Következő szint', value: `${Math.round((1 - Math.pow(def.value.hatcherySpeedPerLevel ?? 0.9, nl)) * 100)}%` });
      break;
    case ChamberType.PHEROMONE_GLAND:
      s.push({ label: 'Feromonok', value: `${(def.value.pheromonesPerLevel ?? 2) * lv}` });
      if (!isMaxLevel.value)
        s.push({ label: 'Következő szint', value: `${(def.value.pheromonesPerLevel ?? 2) * nl}` });
      break;
  }
  return s;
});

const upgradeCost = computed(() => {
  if (!def.value || isMaxLevel.value) return null;
  return calculateBuildCost(
    def.value.baseBiomassCost,
    def.value.baseWaterCost,
    nextLevel.value,
  );
});

async function upgrade() {
  if (!def.value) return;
  building.value = true;
  buildError.value = null;
  try {
    await store.upgradeChamber(props.chamber.type);
    emit('upgraded', props.chamber);
  } catch (e: unknown) {
    buildError.value =
      (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || 'Építés sikertelen';
  } finally {
    building.value = false;
  }
}

// Icon mapping
const chamberIcons: Record<string, string> = {
  QUEEN: '👑',
  HATCHERY: '🥚',
  DIGESTIVE_PIT: '🕳️',
  ACID_GLAND: '☣️',
  MUSHROOM_GARDEN: '🍄',
  ROOT_SIPHON: '🌿',
  HEAT_CHAMBER: '🔥',
  PHEROMONE_GLAND: '〰️',
};

function icon(type: string): string {
  return chamberIcons[type] ?? '⬡';
}
</script>

<template>
  <div
    class="rounded-lg border bg-black/40 transition-all hover:border-red-800/50"
    :class="[
      isMaxLevel ? 'border-zinc-800/50 opacity-70' : 'border-red-950/30',
      isQueen ? 'ring-1 ring-red-900/50' : '',
    ]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-3 border-b border-red-950/20">
      <div class="flex items-center gap-2">
        <span class="text-lg">{{ icon(chamber.type) }}</span>
        <div>
          <div class="font-semibold text-sm text-zinc-200">
            {{ def?.name ?? chamber.type }}
          </div>
          <div class="text-xs text-zinc-500">
            Szint {{ chamber.level }}/{{ def?.maxLevel }}
          </div>
        </div>
      </div>

      <!-- Upgrade button (non-queen only) -->
      <button
        v-if="!isQueen && !isMaxLevel"
        :disabled="building"
        class="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
        :class="building
          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          : 'bg-red-900/50 hover:bg-red-800 text-red-300 hover:text-red-200'"
        @click="upgrade"
      >
        {{ building ? '...' : `⬆ ${nextLevel}. szint` }}
      </button>
      <span
        v-else-if="isMaxLevel"
        class="text-xs text-zinc-600 font-semibold"
      >
        MAX
      </span>
      <span
        v-else
        class="text-xs text-red-800 font-semibold italic"
      >
        A kaptár szíve
      </span>
    </div>

    <!-- Stats -->
    <div class="p-3 space-y-1.5">
      <div
        v-if="def?.description"
        class="text-xs text-zinc-500 italic mb-2"
      >
        {{ def.description }}
      </div>
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="flex justify-between text-xs"
      >
        <span class="text-zinc-500">{{ stat.label }}</span>
        <span class="text-zinc-300">{{ stat.value }}</span>
      </div>

      <!-- Cost preview -->
      <div
        v-if="upgradeCost && !isMaxLevel"
        class="mt-2 pt-2 border-t border-red-950/20 flex gap-3 text-xs"
      >
        <span class="text-green-700">
          🧬 {{ upgradeCost.biomass }}
        </span>
        <span class="text-blue-600">
          💧 {{ upgradeCost.water }}
        </span>
      </div>

      <!-- Error -->
      <div
        v-if="buildError"
        class="mt-1 text-xs text-red-500"
      >
        {{ buildError }}
      </div>
    </div>
  </div>
</template>
