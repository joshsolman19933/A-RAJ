import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { mutationService } from '@/services/mutation.service';
import type { MutationData } from '@a-raj/shared';
import { MUTATION_DNA_NECTAR_COST_PER_LEVEL } from '@a-raj/shared';
import type { TreeResponse, ResearchResponse } from '@/services/mutation.service';
import { useHiveStore } from './hive.store';
import type { UnitType } from '@a-raj/shared';

export const useMutationStore = defineStore('mutation', () => {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const tree = ref<TreeResponse>([]);
  const lastUnlockedUnits = ref<UnitType[]>([]);

  const researchedMutations = computed(() =>
    tree.value.filter((n) => n.researchedLevel > 0),
  );

  const hasResearched = computed(() => researchedMutations.value.length > 0);

  const dnaNectarCost = (targetLevel: number) =>
    targetLevel * MUTATION_DNA_NECTAR_COST_PER_LEVEL;

  async function fetchTree() {
    loading.value = true;
    error.value = null;
    try {
      tree.value = await mutationService.getTree();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      error.value = err?.response?.data?.message || 'Failed to load mutation tree';
    } finally {
      loading.value = false;
    }
  }

  async function research(mutationType: string): Promise<ResearchResponse> {
    error.value = null;
    loading.value = true;
    try {
      const result = await mutationService.research(mutationType);
      // Update hive store DNA Nectar
      const hiveStore = useHiveStore();
      hiveStore.resources = { ...result.resources };
      hiveStore.serverResources = { ...result.resources };
      lastUnlockedUnits.value = result.unlockedUnits;
      // Refresh tree
      await fetchTree();
      return result;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      error.value = err?.response?.data?.message || 'Failed to research mutation';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    error,
    tree,
    lastUnlockedUnits,
    researchedMutations,
    hasResearched,
    dnaNectarCost,
    fetchTree,
    research,
  };
});
