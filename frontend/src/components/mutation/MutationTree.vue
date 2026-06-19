<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMutationStore } from '@/stores/mutation.store';
import { MutationType, MUTATION_TREE } from '@a-raj/shared';
import type { MutationTreeNode } from '@a-raj/shared';
import { useHiveStore } from '@/stores/hive.store';

const store = useMutationStore();
const hiveStore = useHiveStore();

const researchError = ref<string | null>(null);

const activeNode = ref<MutationType | null>(null);

function isNodeLocked(node: MutationTreeNode & { researchedLevel: number }): boolean {
  if (node.researchedLevel > 0) return false;
  if (node.prerequisites.length === 0) return true; // no prereqs = available
  return node.prerequisites.every((p) => {
    const prereqNode = store.tree.find((n) => n.type === p.type);
    return prereqNode && prereqNode.researchedLevel >= p.level;
  });
}

function canResearch(node: MutationTreeNode & { researchedLevel: number }): boolean {
  if (node.researchedLevel >= node.maxLevel) return false;
  const targetLevel = node.researchedLevel + 1;
  const cost = store.dnaNectarCost(targetLevel);
  return hiveStore.resources.dnaNectar >= cost;
}

async function doResearch(mutationType: MutationType) {
  researchError.value = null;
  activeNode.value = mutationType;
  try {
    await store.research(mutationType);
    activeNode.value = null;
  } catch (e: unknown) {
    researchError.value =
      (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || 'Kutatás sikertelen';
    activeNode.value = null;
  }
}

const mutationIcons: Record<string, string> = {
  ARMOR: '🛡️',
  ACID_SPIT: '🧪',
  METABOLISM: '⚡',
  MUSHROOM_VENOM: '🍄',
  DEEP_ROOT: '🌿',
};
</script>

<template>
  <div class="space-y-4">
    <!-- Error banner -->
    <div
      v-if="store.error || researchError"
      class="p-3 bg-red-950/50 border border-red-800 rounded-lg text-sm text-red-300"
    >
      {{ store.error || researchError }}
    </div>

    <!-- Loading -->
    <div
      v-if="store.loading && store.tree.length === 0"
      class="text-center py-8 text-zinc-500"
    >
      <div class="animate-pulse">Mutációs háló betöltése...</div>
    </div>

    <!-- Mutations grid -->
    <div class="grid gap-3">
      <div
        v-for="node in store.tree"
        :key="node.type"
        class="rounded-lg border p-4 transition-all"
        :class="[
          node.researchedLevel > 0
            ? 'border-red-800/40 bg-red-950/10'
            : isNodeLocked(node)
              ? 'border-zinc-800/30 bg-black/30 opacity-50'
              : 'border-red-950/30 bg-black/40 hover:border-red-800/50',
        ]"
      >
        <!-- Header row -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-lg">{{ mutationIcons[node.type] ?? '🧬' }}</span>
            <div>
              <div class="font-semibold text-sm text-zinc-200">
                {{ node.name }}
              </div>
              <div class="text-xs text-zinc-500">
                Szint {{ node.researchedLevel }}/{{ node.maxLevel }}
              </div>
            </div>
          </div>

          <!-- Research button -->
          <button
            v-if="canResearch(node)"
            :disabled="store.loading && activeNode === node.type"
            class="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-900/50 hover:bg-red-800 text-red-300 transition-all disabled:opacity-50"
            @click="doResearch(node.type)"
          >
            {{ store.loading && activeNode === node.type ? '...' : `Kutatás → ${node.researchedLevel + 1}` }}
          </button>
          <span
            v-else-if="node.researchedLevel >= node.maxLevel"
            class="text-xs text-zinc-600 font-semibold"
          >
            MAX
          </span>
          <span
            v-else-if="!isNodeLocked(node)"
            class="text-xs text-zinc-500"
          >
            🔒 Zárolt
          </span>
          <div v-else class="text-xs text-zinc-500">
            🧬 {{ store.dnaNectarCost(node.researchedLevel + 1) }} DNS
          </div>
        </div>

        <!-- Description -->
        <p class="text-xs text-zinc-500 mb-2">{{ node.description }}</p>

        <!-- Prerequisites -->
        <div v-if="node.prerequisites.length > 0 && node.researchedLevel === 0" class="text-xs text-zinc-600 mb-1">
          Előfeltétel:
          <span
            v-for="(p, i) in node.prerequisites"
            :key="p.type"
          >
            {{ MUTATION_TREE.find((n) => n.type === p.type)?.name ?? p.type }} lv{{ p.level }}<span v-if="i < node.prerequisites.length - 1">, </span>
          </span>
        </div>

        <!-- Synergies -->
        <div
          v-if="node.synergies.length > 0"
          class="mt-2 pt-2 border-t border-red-950/20"
        >
          <div
            v-for="synergy in node.synergies"
            :key="synergy.bonusDescription"
            class="text-xs"
            :class="
              node.unlocksUnit === synergy.unlocksUnit
                ? 'text-green-600'
                : 'text-zinc-600'
            "
          >
            {{ node.unlocksUnit === synergy.unlocksUnit ? '✅ ' : '⬡ ' }}
            {{ synergy.bonusDescription }}
          </div>
        </div>

        <!-- Progress bar -->
        <div
          v-if="node.researchedLevel > 0"
          class="mt-3 w-full bg-zinc-900 rounded-full h-1.5"
        >
          <div
            class="bg-red-800 h-1.5 rounded-full transition-all"
            :style="{ width: `${(node.researchedLevel / node.maxLevel) * 100}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Unlock notification -->
    <div
      v-if="store.lastUnlockedUnits.length > 0"
      class="p-3 bg-green-950/30 border border-green-900 rounded-lg text-sm text-green-400 animate-pulse"
    >
      🎉 Új egység feloldva: {{ store.lastUnlockedUnits.join(', ') }}!
    </div>

    <!-- Empty state -->
    <div
      v-if="store.tree.length === 0"
      class="text-center py-8 text-zinc-600 text-sm italic"
    >
      A mutációs háló nem elérhető.
    </div>
  </div>
</template>
