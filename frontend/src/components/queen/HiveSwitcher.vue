<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useHiveStore } from '@/stores/hive.store';
import type { HiveBrief } from '@a-raj/shared';

const store = useHiveStore();

const isDropdownOpen = ref(false);

onMounted(async () => {
  if (store.hives.length === 0) {
    await store.fetchHives();
  }
});

const currentLabel = computed(() => {
  if (!store.activeHiveBrief) return 'Kaptár kiválasztása...';
  const h = store.activeHiveBrief;
  return `Kaptár (${h.q}, ${h.r})`;
});

function onSwitch(hive: HiveBrief) {
  if (hive.id === store.activeHiveId) return;
  store.switchHive(hive.id);
  isDropdownOpen.value = false;
}

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value;
}

function closeDropdown() {
  // Use setTimeout so the click on a hive button fires before blur closes the dropdown
  setTimeout(() => {
    isDropdownOpen.value = false;
  }, 150);
}

function resourceColor(value: number, type: 'biomass' | 'water' | 'heat' | 'dnaNectar'): string {
  if (value <= 0) return 'text-red-500';
  switch (type) {
    case 'dnaNectar':
      return value > 0 ? 'text-purple-400' : 'text-zinc-600';
    default:
      return 'text-zinc-300';
  }
}
</script>

<template>
  <div
    v-if="store.hasMultipleHives"
    class="relative inline-block"
  >
    <!-- Dropdown trigger -->
    <div class="relative">
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-950/30 bg-black/50 hover:bg-black/80 text-sm text-zinc-300 transition-all"
        :aria-label="`Kaptár választása — ${currentLabel}`"
        aria-haspopup="listbox"
        :aria-expanded="isDropdownOpen"
        @click="toggleDropdown"
        @blur="closeDropdown"
      >
        <span class="text-red-500 text-lg leading-none">&#9763;</span>
        <span class="text-xs">{{ currentLabel }}</span>
        <span class="text-zinc-600 text-xs ml-0.5 transition-transform" :class="isDropdownOpen ? 'rotate-180' : ''">&#9660;</span>
      </button>

      <!-- Dropdown menu -->
      <div
        v-if="isDropdownOpen"
        role="listbox"
        aria-label="Kaptárak listája"
        class="absolute top-full right-0 mt-1 w-64 rounded-lg border border-red-950/40 bg-black/90 backdrop-blur-sm shadow-xl shadow-red-950/20 z-50"
      >
        <div class="p-1.5">
          <div class="text-xs text-zinc-600 px-2 py-1 font-medium tracking-wide uppercase">
            Kaptáraid ({{ store.hives.length }})
          </div>

          <button
            v-for="hive in store.hives"
            :key="hive.id"
            role="option"
            :aria-selected="hive.id === store.activeHiveId"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all hover:bg-red-950/20"
            :class="hive.id === store.activeHiveId
              ? 'bg-red-950/30 border border-red-900/30'
              : 'border border-transparent'"
            @click="onSwitch(hive)"
          >
            <div class="flex-shrink-0">
              <span
                class="text-lg leading-none"
                :class="hive.id === store.activeHiveId ? 'text-red-500' : 'text-zinc-500'"
              >&#9763;</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="text-sm font-medium truncate"
                  :class="hive.id === store.activeHiveId ? 'text-red-400' : 'text-zinc-300'"
                >
                  ({{ hive.q }}, {{ hive.r }})
                </span>
                <span
                  v-if="hive.id === store.activeHiveId"
                  class="text-[10px] text-red-600 bg-red-950/40 px-1.5 py-0.5 rounded-full"
                >
                  aktív
                </span>
              </div>
              <div class="flex gap-2 mt-0.5 text-[11px]">
                <span :class="resourceColor(hive.resources.biomass, 'biomass')">
                  &#9679; {{ Math.floor(hive.resources.biomass) }}
                </span>
                <span :class="resourceColor(hive.resources.water, 'water')">
                  &#9830; {{ Math.floor(hive.resources.water) }}
                </span>
                <span :class="resourceColor(hive.resources.dnaNectar, 'dnaNectar')">
                  &#10022; {{ Math.floor(hive.resources.dnaNectar) }}
                </span>
              </div>
            </div>
            <span
              v-if="hive.id === store.activeHiveId"
              class="text-red-500 text-sm flex-shrink-0"
            >&#10003;</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Single hive: simple label -->
  <div v-else-if="store.hasHive" class="flex items-center gap-1.5 text-xs text-zinc-500">
    <span class="text-red-600 text-lg leading-none">&#9763;</span>
    <span>Kaptár ({{ store.hiveQ }}, {{ store.hiveR }})</span>
  </div>
</template>
