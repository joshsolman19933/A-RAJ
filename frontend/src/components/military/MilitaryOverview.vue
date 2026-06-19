<script setup lang="ts">
import type { UnitBatchData } from '@a-raj/shared';
import AttritionCountdown from './AttritionCountdown.vue';

defineProps<{
  batches: UnitBatchData[];
}>();

const unitIcons: Record<string, string> = {
  WORKER: '🐜',
  BLOOD_TANK: '🪲',
  ACID_SPITTER: '🦂',
  SCOUT_WASP: '🐝',
  QUEEN: '👑',
};

const unitNames: Record<string, string> = {
  WORKER: 'Munkás',
  BLOOD_TANK: 'Vér-Páncélos',
  ACID_SPITTER: 'Sav-Köpő',
  SCOUT_WASP: 'Felderítő Darázs',
  QUEEN: 'Királynő',
};

function icon(type: string): string {
  return unitIcons[type] ?? '⬡';
}

function name(type: string): string {
  return unitNames[type] ?? type;
}
</script>

<template>
  <div class="rounded-lg border border-red-950/30 bg-black/40 overflow-hidden">
    <div
      v-for="batch in batches"
      :key="batch.id"
      class="flex items-center justify-between p-3 border-b border-red-950/20 last:border-0 hover:bg-red-950/10 transition-colors"
    >
      <div class="flex items-center gap-3">
        <span class="text-xl">{{ icon(batch.unitType) }}</span>
        <div>
          <div class="font-semibold text-sm text-zinc-200">
            {{ name(batch.unitType) }}
          </div>
          <div class="text-xs text-zinc-500 flex items-center gap-2">
            <span>{{ batch.count }} db</span>
            <span class="text-zinc-700">|</span>
            <AttritionCountdown :batch="batch" />
          </div>
        </div>
      </div>
      <div class="text-xs text-zinc-600">
        Kikelt: {{ new Date(batch.hatchedAt).toLocaleDateString('hu-HU') }}
      </div>
    </div>
  </div>
</template>
