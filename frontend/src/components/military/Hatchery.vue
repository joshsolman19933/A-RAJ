<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMilitaryStore } from '@/stores/military.store';
import { UnitType, UNIT_STATS } from '@a-raj/shared';
import { useHiveStore } from '@/stores/hive.store';

const militaryStore = useMilitaryStore();
const hiveStore = useHiveStore();

const selectedUnit = ref<UnitType>(UnitType.WORKER);
const count = ref(1);
const hatchError = ref<string | null>(null);

const unitList = Object.values(UnitType).filter((t) => t !== UnitType.QUEEN);

const currentStats = computed(() => UNIT_STATS[selectedUnit.value] ?? null);

const totalCost = computed(() => {
  if (!currentStats.value) return { biomass: 0, water: 0, heat: 0 };
  return {
    biomass: currentStats.value.biomassCost * count.value,
    water: currentStats.value.waterCost * count.value,
    heat: currentStats.value.heatCost * count.value,
  };
});

function costFmt(v: number): string {
  return v >= 1000 ? `${Math.floor(v / 1000)}k` : String(v);
}

const canAfford = computed(() => {
  const r = hiveStore.resources;
  return (
    r.biomass >= totalCost.value.biomass &&
    r.water >= totalCost.value.water &&
    r.heat >= totalCost.value.heat
  );
});

async function doHatch() {
  hatchError.value = null;
  try {
    await militaryStore.hatch(selectedUnit.value, count.value);
    count.value = 1;
  } catch (e: unknown) {
    hatchError.value =
      (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || 'Keltetés sikertelen';
  }
}
</script>

<template>
  <div class="rounded-lg border border-red-950/30 bg-black/40 p-4">
    <h3 class="text-sm font-semibold text-zinc-300 mb-4">Új keltetés</h3>

    <!-- Unit selector -->
    <div class="grid grid-cols-2 gap-2 mb-4">
      <button
        v-for="ut in unitList"
        :key="ut"
        class="text-left p-2 rounded border transition-all text-xs"
        :class="
          selectedUnit === ut
            ? 'border-red-700/60 bg-red-950/30 text-red-300'
            : 'border-red-950/20 bg-black/30 text-zinc-400 hover:border-red-800/40'
        "
        @click="selectedUnit = ut"
      >
        {{ ut === 'WORKER' ? '🐜' : ut === 'BLOOD_TANK' ? '🪲' : ut === 'ACID_SPITTER' ? '🦂' : '🐝' }}
        {{ ut === 'WORKER' ? 'Munkás' : ut === 'BLOOD_TANK' ? 'Vér-Páncélos' : ut === 'ACID_SPITTER' ? 'Sav-Köpő' : 'Felderítő Darázs' }}
      </button>
    </div>

    <!-- Unit stats -->
    <div v-if="currentStats" class="mb-4 space-y-1 text-xs text-zinc-500">
      <div class="flex justify-between">
        <span>Élettartam</span>
        <span>{{ currentStats.lifespanHours }} óra</span>
      </div>
      <div class="flex justify-between">
        <span>Sebzés</span>
        <span>{{ currentStats.attackPhysical }} fizikai{{ currentStats.attackAcid ? ` / ${currentStats.attackAcid} sav` : '' }}</span>
      </div>
      <div class="flex justify-between">
        <span>Sebesség</span>
        <span>{{ currentStats.speed }} mező/ó</span>
      </div>
    </div>

    <!-- Count slider -->
    <div class="mb-4">
      <label class="block text-xs text-zinc-400 mb-2">
        Darabszám: <span class="text-zinc-200 font-semibold">{{ count }}</span>
      </label>
      <input
        v-model.number="count"
        type="range"
        :min="1"
        :max="100"
        class="w-full accent-red-700"
      />
      <div class="flex justify-between text-xs text-zinc-600">
        <span>1</span>
        <span>100</span>
      </div>
    </div>

    <!-- Cost -->
    <div class="flex gap-4 mb-3 text-xs">
      <span class="text-green-600">
        🧬 {{ costFmt(totalCost.biomass) }}
      </span>
      <span class="text-blue-500">
        💧 {{ costFmt(totalCost.water) }}
      </span>
      <span class="text-orange-500">
        🔥 {{ costFmt(totalCost.heat) }}
      </span>
    </div>

    <!-- Afford warning -->
    <div
      v-if="!canAfford"
      class="text-xs text-red-500 mb-3"
    >
      Nincs elég nyersanyag!
    </div>

    <!-- Hatch error -->
    <div
      v-if="hatchError"
      class="text-xs text-red-500 mb-3"
    >
      {{ hatchError }}
    </div>

    <!-- Hatch button -->
    <button
      :disabled="militaryStore.loading || !canAfford"
      class="w-full py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-red-900/50 hover:bg-red-800 text-red-300"
      @click="doHatch"
    >
      {{ militaryStore.loading ? 'Keltetés...' : `Keltetés (${count} db)` }}
    </button>
  </div>
</template>
