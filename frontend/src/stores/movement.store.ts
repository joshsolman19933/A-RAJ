import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { movementService } from '@/services/movement.service';
import type { MovementData, UnitBatchBrief, CombatReport } from '@a-raj/shared';
import { useHiveStore } from './hive.store';
import { useMilitaryStore } from './military.store';

export const useMovementStore = defineStore('movement', () => {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const movements = ref<MovementData[]>([]);

  // Last combat report for display
  const lastReport = ref<CombatReport | null>(null);
  const showReport = ref(false);

  // Screen flash state
  const screenFlash = ref<'victory' | 'defeat' | null>(null);

  const hasActiveMovements = computed(() => movements.value.length > 0);

  async function fetchMovements() {
    loading.value = true;
    error.value = null;
    try {
      movements.value = await movementService.getActive();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      error.value =
        err?.response?.data?.message || 'Failed to load movements';
    } finally {
      loading.value = false;
    }
  }

  async function sendAttack(params: {
    attackType: string;
    targetQ: number;
    targetR: number;
    units: UnitBatchBrief[];
  }): Promise<CombatReport> {
    error.value = null;
    loading.value = true;
    try {
      const result = await movementService.send(params);

      // Show combat report
      lastReport.value = result.combatReport;
      showReport.value = true;

      // Flash screen edge
      screenFlash.value = result.combatReport.isVictory
        ? 'victory'
        : 'defeat';
      setTimeout(() => {
        screenFlash.value = null;
      }, 1500);

      // Refresh hive resources and units after combat
      const hiveStore = useHiveStore();
      await hiveStore.fetchHive();
      const militaryStore = useMilitaryStore();
      await militaryStore.fetchUnits();

      return result.combatReport;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      error.value =
        err?.response?.data?.message || 'Failed to send attack';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function closeReport() {
    showReport.value = false;
    lastReport.value = null;
  }

  return {
    loading,
    error,
    movements,
    lastReport,
    showReport,
    screenFlash,
    hasActiveMovements,
    fetchMovements,
    sendAttack,
    closeReport,
  };
});
