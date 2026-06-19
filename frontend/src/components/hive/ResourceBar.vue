<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useHiveStore } from '@/stores/hive.store';

const store = useHiveStore();

// rAF-based ticker
const tickInterval = ref(0.5); // seconds between ticks
let lastTick = performance.now();
let rafId = 0;

const storageCap = computed(() => store.getStorageCapacity());

function animate(now: number) {
  const delta = (now - lastTick) / 1000;
  if (delta >= tickInterval.value) {
    store.tickResources(delta, storageCap.value);
    lastTick = now;
  }
  rafId = requestAnimationFrame(animate);
}

onMounted(() => {
  lastTick = performance.now();
  rafId = requestAnimationFrame(animate);
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
});

// Normalize heat bar to a reasonable max (adjustable)
const HEAT_BAR_REFERENCE = 300;

function heatBarWidth(heat: number): string {
  return Math.min(100, Math.max(0, (heat / HEAT_BAR_REFERENCE) * 100)) + '%';
}
function fmt(v: number): string {
  return v >= 1000 ? Math.floor(v).toLocaleString() : v.toFixed(1);
}

function rateFmt(perHour: number, icon: string): string {
  if (perHour === 0) return '';
  return `${icon}${perHour >= 0 ? '+' : ''}${fmt(perHour)}/ó`;
}
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <!-- Biomass -->
    <div class="p-3 rounded-lg border border-green-950/40 bg-black/40">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-green-600 font-semibold">BIOMASSZA</span>
        <span class="text-xs text-green-800">{{ rateFmt(store.productionRates.biomassPerHour, '+') }}</span>
      </div>
      <div class="text-xl font-mono text-green-400 tabular-nums">
        {{ fmt(store.resources.biomass) }}
      </div>
      <div class="mt-1 h-1 bg-green-950/50 rounded-full overflow-hidden">
        <div
          class="h-full bg-green-700 rounded-full transition-all duration-500"
          :style="{ width: Math.min(100, (store.resources.biomass / store.getStorageCapacity()) * 100) + '%' }"
        />
      </div>
    </div>

    <!-- Water -->
    <div class="p-3 rounded-lg border border-blue-950/40 bg-black/40">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-blue-500 font-semibold">VÍZ</span>
        <span class="text-xs text-blue-800">{{ rateFmt(store.productionRates.waterPerHour, '+') }}</span>
      </div>
      <div class="text-xl font-mono text-blue-400 tabular-nums">
        {{ fmt(store.resources.water) }}
      </div>
      <div class="mt-1 h-1 bg-blue-950/50 rounded-full overflow-hidden">
        <div
          class="h-full bg-blue-700 rounded-full transition-all duration-500"
          :style="{ width: Math.min(100, (store.resources.water / store.getStorageCapacity()) * 100) + '%' }"
        />
      </div>
    </div>

    <!-- Heat -->
    <div class="p-3 rounded-lg border border-orange-950/40 bg-black/40">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-orange-500 font-semibold">HŐ</span>
        <span
          class="text-xs"
          :class="store.isHeatSustainable ? 'text-orange-600' : 'text-red-500'"
        >
          {{ store.isHeatSustainable ? 'FENNTARTHATÓ' : 'HIÁNY!' }}
        </span>
      </div>
      <div
        class="text-xl font-mono tabular-nums"
        :class="store.isHeatSustainable ? 'text-orange-400' : 'text-red-400'"
      >
        {{ fmt(store.resources.heat) }}
      </div>
      <div class="mt-1 h-1 bg-orange-950/50 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="store.isHeatSustainable ? 'bg-orange-600' : 'bg-red-600'"
          :style="{ width: heatBarWidth(store.resources.heat) }"
        />
      </div>
    </div>

    <!-- DNA Nectar -->
    <div class="p-3 rounded-lg border border-purple-950/40 bg-black/40">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-purple-500 font-semibold">DNS NEKTÁR</span>
      </div>
      <div class="text-xl font-mono text-purple-400 tabular-nums">
        {{ fmt(store.resources.dnaNectar) }}
      </div>
      <div class="mt-1 text-xs text-purple-800 italic">
        Nem termelődik automatikusan
      </div>
    </div>
  </div>
</template>
