import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { mapService } from '@/services/map.service';
import type { MapHexData } from '@a-raj/shared';

export const useMapStore = defineStore('map', () => {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const hexes = ref<MapHexData[]>([]);
  const selectedHex = ref<MapHexData | null>(null);

  // Build a lookup map by "q,r" key for O(1) access during rendering
  const hexMap = computed(() => {
    const map = new Map<string, MapHexData>();
    for (const hex of hexes.value) {
      map.set(`${hex.q},${hex.r}`, hex);
    }
    return map;
  });

  function getHex(q: number, r: number): MapHexData | undefined {
    return hexMap.value.get(`${q},${r}`);
  }

  async function fetchViewport(
    qMin: number,
    qMax: number,
    rMin: number,
    rMax: number,
  ) {
    loading.value = true;
    error.value = null;
    try {
      hexes.value = await mapService.getViewport(qMin, qMax, rMin, rMax);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      error.value = err?.response?.data?.message || 'Failed to load map';
    } finally {
      loading.value = false;
    }
  }

  function selectHex(hex: MapHexData | null) {
    selectedHex.value = hex;
  }

  function clearSelection() {
    selectedHex.value = null;
  }

  return {
    loading,
    error,
    hexes,
    selectedHex,
    hexMap,
    fetchViewport,
    getHex,
    selectHex,
    clearSelection,
  };
});
