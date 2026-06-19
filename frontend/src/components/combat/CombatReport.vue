<script setup lang="ts">
import { computed } from 'vue';
import { useMovementStore } from '@/stores/movement.store';
import { ChamberType } from '@a-raj/shared';
import type { CombatReport } from '@a-raj/shared';
import { getUnitNameShort } from '@/lib/unit-labels';

const store = useMovementStore();

const report = computed<CombatReport | null>(() => store.lastReport);

const title = computed(() =>
  report.value?.isVictory ? '🏆 Győzelem!' : '💀 Vereség',
);

const titleClass = computed(() =>
  report.value?.isVictory
    ? 'text-amber-400'
    : 'text-red-500',
);

const totalAttackerLosses = computed(() =>
  (report.value?.attackerLosses ?? []).reduce((s, l) => s + l.count, 0),
);

const totalDefenderLosses = computed(() =>
  (report.value?.defenderLosses ?? []).reduce((s, l) => s + l.count, 0),
);  const unitName = (type: string): string => getUnitNameShort(type);

const chamberLabel = (type: ChamberType): string => {
  const map: Record<string, string> = {
    HATCHERY: 'Keltető',
    DIGESTIVE_PIT: 'Emésztő Verem',
    ACID_GLAND: 'Sav-Mirigy',
    MUSHROOM_GARDEN: 'Gombakert',
    ROOT_SIPHON: 'Gyökér-Szívó',
    HEAT_CHAMBER: 'Hőkamra',
    PHEROMONE_GLAND: 'Feromon-Mirigy',
    QUEEN: 'Királynő Terme',
  };
  return map[type] ?? type;
};
</script>

<template>
  <Teleport to="body">
    <Transition name="report">
      <div
        v-if="store.showReport && report"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/70 backdrop-blur-sm"
          @click="store.closeReport()"
        />

        <!-- Card -->
        <div
          class="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border-2 bg-black/95 p-5 shadow-2xl"
          :class="
            report.isVictory
              ? 'border-amber-600/50'
              : 'border-red-800/50'
          "
        >
          <!-- Title -->
          <div class="text-center mb-4">
            <div class="text-2xl font-bold" :class="titleClass">
              {{ title }}
            </div>
            <div class="text-xs text-zinc-600 mt-1">
              {{ new Date(report.resolvedAt).toLocaleString('hu-HU') }}
            </div>
          </div>

          <!-- Power bars -->
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="text-center">
              <div class="text-xs text-zinc-500 mb-1">Támadó veszteségek</div>
              <div
                class="text-xl font-mono font-bold"
                :class="totalAttackerLosses > 0 ? 'text-red-400' : 'text-zinc-500'"
              >
                {{ totalAttackerLosses }}
              </div>
            </div>
            <div class="text-center">
              <div class="text-xs text-zinc-500 mb-1">Védő veszteségek</div>
              <div
                class="text-xl font-mono font-bold"
                :class="totalDefenderLosses > 0 ? 'text-red-400' : 'text-zinc-500'"
              >
                {{ totalDefenderLosses }}
              </div>
            </div>
          </div>

          <!-- Attacker losses detail -->
          <div v-if="report.attackerLosses.length" class="mb-3">
            <div class="text-xs text-zinc-500 mb-1.5 uppercase tracking-wide">
              Saját veszteségek
            </div>
            <div
              v-for="loss in report.attackerLosses"
              :key="loss.unitType"
              class="flex items-center justify-between py-1 border-b border-red-950/20 last:border-0"
            >
              <span class="text-sm text-zinc-300">{{ unitName(loss.unitType) }}</span>
              <span class="text-sm font-mono text-red-400"
                >−{{ loss.count }}</span
              >
            </div>
          </div>

          <!-- Defender losses detail -->
          <div v-if="report.defenderLosses.length" class="mb-3">
            <div class="text-xs text-zinc-500 mb-1.5 uppercase tracking-wide">
              Ellenséges veszteségek
            </div>
            <div
              v-for="loss in report.defenderLosses"
              :key="loss.unitType"
              class="flex items-center justify-between py-1 border-b border-zinc-800 last:border-0"
            >
              <span class="text-sm text-zinc-300">{{ unitName(loss.unitType) }}</span>
              <span class="text-sm font-mono text-red-400"
                >−{{ loss.count }}</span
              >
            </div>
          </div>

          <!-- No losses -->
          <div
            v-if="!report.attackerLosses.length && !report.defenderLosses.length"
            class="text-center text-sm text-zinc-500 py-2"
          >
            Nincs veszteség egyik oldalon sem
          </div>

          <!-- Loot (RAID) -->
          <div
            v-if="report.resourcesLooted"
            class="mt-3 p-3 rounded-lg bg-amber-950/30 border border-amber-800/30"
          >
            <div class="text-xs text-amber-500/80 mb-1.5 uppercase tracking-wide">
              🎒 Zsákmány
            </div>
            <div class="flex gap-4 text-sm">
              <span v-if="report.resourcesLooted.biomass" class="text-zinc-300">
                🟢 {{ report.resourcesLooted.biomass }} Bio
              </span>
              <span v-if="report.resourcesLooted.water" class="text-zinc-300">
                💧 {{ report.resourcesLooted.water }} Víz
              </span>
              <span
                v-if="report.resourcesLooted.dnaNectar"
                class="text-zinc-300"
              >
                🧬 {{ report.resourcesLooted.dnaNectar }} DNS
              </span>
            </div>
          </div>

          <!-- Destroyed chambers (SIEGE) -->
          <div
            v-if="report.chambersDestroyed?.length"
            class="mt-3 p-3 rounded-lg bg-red-950/30 border border-red-800/30"
          >
            <div class="text-xs text-red-500 mb-1.5 uppercase tracking-wide">
              💥 Lerombolt kamrák
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="ch in report.chambersDestroyed"
                :key="ch"
                class="px-2 py-0.5 rounded text-xs bg-red-900/40 border border-red-800/30 text-red-300"
              >
                {{ chamberLabel(ch) }}
              </span>
            </div>
          </div>

          <!-- Close button -->
          <button
            class="mt-5 w-full py-2 rounded-lg text-sm font-medium transition-colors"
            :class="
              report.isVictory
                ? 'bg-amber-900/30 border border-amber-700/30 text-amber-400 hover:bg-amber-900/50'
                : 'bg-red-900/30 border border-red-700/30 text-red-400 hover:bg-red-900/50'
            "
            @click="store.closeReport()"
          >
            Bezár
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.report-enter-active {
  transition: all 0.3s ease-out;
}
.report-leave-active {
  transition: all 0.2s ease-in;
}
.report-enter-from {
  opacity: 0;
  transform: scale(0.9);
}
.report-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
