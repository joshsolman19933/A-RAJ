<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from 'vue';
import type { UnitBatchData } from '@a-raj/shared';
import { UNIT_STATS } from '@a-raj/shared';

const props = defineProps<{
  batch: UnitBatchData;
}>();

const now = ref(Date.now());
const timer = setInterval(() => { now.value = Date.now(); }, 1000);
onUnmounted(() => clearInterval(timer));

const stats = computed(() => UNIT_STATS[props.batch.unitType] ?? null);
const hatchedAt = computed(() => new Date(props.batch.hatchedAt).getTime());
const lifespanMs = computed(() => (stats.value?.lifespanHours ?? 0) * 60 * 60 * 1000);
const expiryAt = computed(() => hatchedAt.value + lifespanMs.value);

const remainingMs = computed(() => Math.max(0, expiryAt.value - now.value));
const remainingHours = computed(() => remainingMs.value / (1000 * 60 * 60));

const isExpired = computed(() => remainingMs.value <= 0);

// Stop timer once expired
watch(isExpired, (expired) => { if (expired) clearInterval(timer); });

const isUrgent = computed(() => remainingHours.value < 6 && !isExpired.value);

const hours = computed(() => Math.floor(remainingHours.value));
const minutes = computed(() => Math.floor((remainingHours.value - hours.value) * 60));
</script>

<template>
  <span
    class="text-xs font-mono tabular-nums"
    :class="{
      'text-red-500 animate-pulse': isUrgent,
      'text-zinc-500 line-through': isExpired,
      'text-zinc-400': !isUrgent && !isExpired,
    }"
  >
    <template v-if="isExpired">
      EXPIRED
    </template>
    <template v-else>
      {{ hours }}ó {{ String(minutes).padStart(2, '0') }}p
    </template>
  </span>
</template>
