import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { militaryService } from '@/services/military.service';
import type { UnitBatchData } from '@a-raj/shared';
import type { HatchResponse } from '@/services/military.service';
import { useHiveStore } from './hive.store';

export const useMilitaryStore = defineStore('military', () => {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const units = ref<UnitBatchData[]>([]);

  const totalUnits = computed(() => units.value.reduce((sum, b) => sum + b.count, 0));

  const unitsByType = computed(() => {
    const map = new Map<string, { type: string; count: number; batches: UnitBatchData[] }>();
    for (const b of units.value) {
      if (!map.has(b.unitType)) {
        map.set(b.unitType, { type: b.unitType, count: 0, batches: [] });
      }
      const entry = map.get(b.unitType)!;
      entry.count += b.count;
      entry.batches.push(b);
    }
    return [...map.values()];
  });

  const hasUnits = computed(() => units.value.length > 0);

  async function fetchUnits() {
    loading.value = true;
    error.value = null;
    try {
      units.value = await militaryService.getUnits();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      error.value = err?.response?.data?.message || 'Failed to load units';
    } finally {
      loading.value = false;
    }
  }

  async function hatch(unitType: string, count: number): Promise<HatchResponse> {
    error.value = null;
    loading.value = true;
    try {
      const result = await militaryService.hatch(unitType, count);
      // Update hive store resources from hatch response
      const hiveStore = useHiveStore();
      hiveStore.resources = { ...result.resources };
      hiveStore.serverResources = { ...result.resources };
      // Refresh unit list
      await fetchUnits();
      return result;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      error.value = err?.response?.data?.message || 'Failed to hatch units';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    error,
    units,
    totalUnits,
    unitsByType,
    hasUnits,
    fetchUnits,
    hatch,
  };
});
