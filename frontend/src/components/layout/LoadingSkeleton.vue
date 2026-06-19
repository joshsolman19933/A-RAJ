<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    variant?: 'card' | 'text' | 'resource' | 'chamber-grid';
    count?: number;
  }>(),
  {
    variant: 'text',
    count: 3,
  },
);

const items = computed(() => Array.from({ length: props.count }, (_, i) => i));
</script>

<template>
  <!-- Shimmer CSS is defined in main.css via @keyframes skeleton-shimmer -->
  <div class="skeleton-container" role="status" aria-label="Betöltés">
    <!-- Card variant: full-width rectangular placeholder cards -->
    <template v-if="variant === 'card'">
      <div
        v-for="i in items"
        :key="i"
        class="rounded-lg border border-zinc-800/50 bg-zinc-950/50 p-4 space-y-3 skeleton-shimmer mb-3"
      >
        <div class="h-4 w-2/3 bg-zinc-900/80 rounded skeleton-shimmer-item" />
        <div class="h-3 w-full bg-zinc-900/80 rounded skeleton-shimmer-item" />
        <div class="h-3 w-5/6 bg-zinc-900/80 rounded skeleton-shimmer-item" />
      </div>
    </template>

    <!-- Text variant: simple line placeholders -->
    <template v-else-if="variant === 'text'">
      <div
        v-for="i in items"
        :key="i"
        class="skeleton-shimmer mb-2"
      >
        <div
          class="h-3 bg-zinc-900/80 rounded skeleton-shimmer-item"
          :style="{ width: `${70 + (i % 3) * 10}%` }"
        />
      </div>
    </template>

    <!-- Resource variant: 4-column resource bar skeleton -->
    <template v-else-if="variant === 'resource'">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          v-for="i in 4"
          :key="i"
          class="p-3 rounded-lg border border-zinc-800/50 bg-zinc-950/50 skeleton-shimmer"
        >
          <div class="h-3 w-12 bg-zinc-900/80 rounded skeleton-shimmer-item mb-2" />
          <div class="h-6 w-20 bg-zinc-900/80 rounded skeleton-shimmer-item mb-1" />
          <div class="h-1 w-full bg-zinc-900/80 rounded-full skeleton-shimmer-item" />
        </div>
      </div>
    </template>

    <!-- Chamber-grid variant: 2-column chamber card skeleton -->
    <template v-else-if="variant === 'chamber-grid'">
      <div class="grid gap-3" :class="count > 2 ? 'grid-cols-1 md:grid-cols-2' : ''">
        <div
          v-for="i in items"
          :key="i"
          class="rounded-lg border border-zinc-800/50 bg-zinc-950/50 p-3 skeleton-shimmer"
        >
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded bg-zinc-900/80 skeleton-shimmer-item" />
            <div class="flex-1">
              <div class="h-4 w-24 bg-zinc-900/80 rounded skeleton-shimmer-item mb-1" />
              <div class="h-3 w-16 bg-zinc-900/80 rounded skeleton-shimmer-item" />
            </div>
          </div>
          <div class="h-3 w-full bg-zinc-900/80 rounded skeleton-shimmer-item mb-1" />
          <div class="h-3 w-2/3 bg-zinc-900/80 rounded skeleton-shimmer-item" />
        </div>
      </div>
    </template>

    <span class="sr-only">Betöltés folyamatban...</span>
  </div>
</template>
