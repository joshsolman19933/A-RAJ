import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { hiveService } from '@/services/hive.service';
import type {
  HiveData,
  HiveBrief,
  Resources,
  ProductionRates,
  ChamberData,
} from '@a-raj/shared';
import { ChamberType, CHAMBER_DEFINITIONS } from '@a-raj/shared';
import type { UpgradeChamberResponse } from '@/services/hive.service';

export const useHiveStore = defineStore('hive', () => {
  // --- State ---
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastFetch = ref<Date | null>(null);

  // Multi-hive support
  const hives = ref<HiveBrief[]>([]);
  const activeHiveId = ref<string | null>(null);

  // Derived ref for backward compatibility — always reflects activeHiveId
  const hiveId = computed(() => activeHiveId.value);
  const hiveQ = ref(0);
  const hiveR = ref(0);
  const chambers = ref<ChamberData[]>([]);
  const lastUpdated = ref<string | null>(null);

  // Visual resources (ticked client-side between fetches)
  const resources = ref<Resources>({
    biomass: 0,
    water: 0,
    heat: 0,
    dnaNectar: 0,
  });

  const productionRates = ref<ProductionRates>({
    biomassPerHour: 0,
    waterPerHour: 0,
    heatPerHour: 0,
    heatConsumptionPerHour: 0,
  });

  // Server-authoritative resources (snapshot from last fetch)
  const serverResources = ref<Resources>({
    biomass: 0,
    water: 0,
    heat: 0,
    dnaNectar: 0,
  });

  // --- Computed ---
  const isHeatSustainable = computed(
    () => productionRates.value.heatPerHour >= productionRates.value.heatConsumptionPerHour,
  );

  const netHeatPerHour = computed(
    () => productionRates.value.heatPerHour - productionRates.value.heatConsumptionPerHour,
  );

  const hasHive = computed(() => !!activeHiveId.value);

  const hasMultipleHives = computed(() => hives.value.length > 1);

  const activeHiveBrief = computed(() =>
    hives.value.find((h) => h.id === activeHiveId.value) ?? null,
  );

  // --- Actions ---

  /** Fetch all hives for multi-hive support */
  async function fetchHives() {
    try {
      hives.value = await hiveService.getAllHives();
      // Set active from first hive if not set
      if (!activeHiveId.value && hives.value.length > 0) {
        activeHiveId.value = hives.value[0]!.id;
      }
    } catch {
      // Silently ignore — hives list is auxiliary
    }
  }

  /** Switch the active hive and fetch its full data */
  async function switchHive(newHiveId: string) {
    if (newHiveId === activeHiveId.value) return;
    activeHiveId.value = newHiveId;
    await fetchHive();
  }

  /** Fetch the currently active hive */
  async function fetchHive() {
    loading.value = true;
    error.value = null;
    try {
      const data: HiveData = await hiveService.getHive(
        activeHiveId.value ?? undefined,
      );
      applyHiveData(data);
      lastFetch.value = new Date();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      error.value = err?.response?.data?.message || 'Failed to load hive';
    } finally {
      loading.value = false;
    }
  }

  function applyHiveData(data: HiveData) {
    hiveQ.value = data.q;
    hiveR.value = data.r;
    activeHiveId.value = data.id;
    chambers.value = data.chambers;
    productionRates.value = data.productionRates;
    lastUpdated.value = data.lastUpdated;
    serverResources.value = { ...data.resources };
    // Set visual resources to server value on initial load or reset
    resources.value = { ...data.resources };
  }

  /**
   * Tick resources client-side based on production rates.
   * Called every animation frame between server fetches.
   * @param deltaSeconds Seconds elapsed since last tick
   * @param storageCapacity Total storage from Digestive Pits
   */
  function tickResources(deltaSeconds: number, storageCapacity: number) {
    const deltaHours = deltaSeconds / 3600;
    const r = resources.value;
    const p = productionRates.value;

    // Biomass: capped by storage
    const newBiomass = Math.min(
      storageCapacity,
      Math.max(0, r.biomass + p.biomassPerHour * deltaHours),
    );
    const newWater = Math.min(
      storageCapacity,
      Math.max(0, r.water + p.waterPerHour * deltaHours),
    );

    // Heat: balance with consumption, floor at 0
    const netHeat = p.heatPerHour - p.heatConsumptionPerHour;
    const newHeat = Math.max(0, r.heat + netHeat * deltaHours);

    resources.value = {
      biomass: newBiomass,
      water: newWater,
      heat: newHeat,
      dnaNectar: r.dnaNectar, // Not auto-produced
    };
  }

  /**
   * Recalculate production rates from local chamber list.
   * Used after upgradeChamber for instant UI feedback.
   */
  function recalcProductionRates() {
    let bio = 0;
    let water = 0;
    let heat = 0;
    let heatCons = 0;

    for (const c of chambers.value) {
      const def = CHAMBER_DEFINITIONS[c.type];
      switch (c.type) {
        case ChamberType.MUSHROOM_GARDEN:
          bio += (def.biomassPerHourPerLevel ?? 0) * c.level;
          break;
        case ChamberType.ROOT_SIPHON:
          water += (def.waterPerHourPerLevel ?? 0) * c.level;
          break;
        case ChamberType.HEAT_CHAMBER:
          heat += (def.heatPerHourPerLevel ?? 0) * c.level;
          break;
        case ChamberType.QUEEN:
          heatCons += c.level * 2;
          break;
      }
    }

    productionRates.value = {
      biomassPerHour: bio,
      waterPerHour: water,
      heatPerHour: heat,
      heatConsumptionPerHour: heatCons,
    };
  }

  /**
   * Get storage capacity from chambers.
   */
  function getStorageCapacity(): number {
    let capacity = 500; // Base capacity
    for (const c of chambers.value) {
      if (c.type === ChamberType.DIGESTIVE_PIT) {
        capacity += 1000 * c.level; // storagePerLevel from constants
      }
    }
    return capacity;
  }

  /**
   * Upgrade a chamber. Returns the updated chamber and resources.
   */
  async function upgradeChamber(chamberType: string): Promise<UpgradeChamberResponse> {
    error.value = null;
    try {
      const result = await hiveService.upgradeChamber(chamberType);
      // Apply server response immediately for responsive UI
      resources.value = { ...result.resources };
      serverResources.value = { ...result.resources };
      // Update local chamber list
      const existingIdx = chambers.value.findIndex(
        (c) => c.type === result.chamber.type,
      );
      if (existingIdx >= 0) {
        const old = chambers.value[existingIdx]!;
        chambers.value[existingIdx] = {
          id: old.id,
          type: old.type,
          level: result.chamber.level,
        };
      } else {
        chambers.value.push({
          id: result.chamber.id,
          type: result.chamber.type as ChamberType,
          level: result.chamber.level,
        });
      }
      // Recalculate rates locally until next server fetch
      recalcProductionRates();
      return result;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      error.value = err?.response?.data?.message || 'Failed to upgrade chamber';
      throw e;
    }
  }

  return {
    // State
    loading,
    error,
    hiveId,
    hiveQ,
    hiveR,
    resources,
    serverResources,
    productionRates,
    chambers,
    lastUpdated,
    lastFetch,
    // Multi-hive
    hives,
    activeHiveId,
    // Computed
    isHeatSustainable,
    netHeatPerHour,
    hasHive,
    hasMultipleHives,
    activeHiveBrief,
    // Actions
    fetchHives,
    switchHive,
    fetchHive,
    tickResources,
    getStorageCapacity,
    upgradeChamber,
  };
});
