<script setup lang="ts">
/**
 * BuildQueue.vue — Építési sor kijelző
 *
 * Placeholder: a BullMQ alapú építési időzítés a későbbi sprintekben
 * lesz implementálva. Jelenleg minden építés azonnali.
 *
 * A komponens a jövőben mutatja majd:
 * - Aktív építések listáját
 * - Hátralévő időt minden építéshez
 * - Építési slotok számát (alap 1, prémium +2)
 */
</script>

<template>
  <div class="rounded-lg border border-red-950/30 bg-black/40 p-4">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-lg">⏳</span>
      <h3 class="font-semibold text-sm text-zinc-300">
        Építési sor
      </h3>
    </div>
    <div class="text-xs text-zinc-500 italic">
      Az építések jelenleg azonnaliak. A BullMQ alapú időzített építkezés
      egy későbbi sprintben kerül bevezetésre.
    </div>
  </div>
</template>
