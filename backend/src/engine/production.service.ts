import { Injectable } from '@nestjs/common';
import {
  ChamberType,
  CHAMBER_DEFINITIONS,
} from '@a-raj/shared';
import type { ChamberData, ProductionRates } from '@a-raj/shared';

/**
 * Calculates resource production rates and storage capacity
 * based on a hive's chamber configuration.
 */
@Injectable()
export class ProductionService {
  /**
   * Calculate production rates from chambers.
   * Heat consumption: Queen chamber and (future) hatcheries consume heat.
   */
  calculateProductionRates(chambers: ChamberData[]): ProductionRates {
    let biomassPerHour = 0;
    let waterPerHour = 0;
    let heatPerHour = 0;
    let heatConsumptionPerHour = 0;

    for (const chamber of chambers) {
      const def = CHAMBER_DEFINITIONS[chamber.type];

      switch (chamber.type) {
        case ChamberType.MUSHROOM_GARDEN:
          biomassPerHour +=
            (def.biomassPerHourPerLevel ?? 0) * chamber.level;
          break;
        case ChamberType.ROOT_SIPHON:
          waterPerHour +=
            (def.waterPerHourPerLevel ?? 0) * chamber.level;
          break;
        case ChamberType.HEAT_CHAMBER:
          heatPerHour +=
            (def.heatPerHourPerLevel ?? 0) * chamber.level;
          break;
        case ChamberType.QUEEN:
          // Queen chamber consumes heat to sustain the hive
          heatConsumptionPerHour += chamber.level * 2;
          break;
        default:
          break;
      }
    }

    return {
      biomassPerHour,
      waterPerHour,
      heatPerHour,
      heatConsumptionPerHour,
    };
  }

  /**
   * Calculate total storage capacity from Digestive Pit chambers.
   * Without any Digestive Pit, base capacity is 500.
   */
  calculateStorageCapacity(chambers: ChamberData[]): number {
    let capacity = 500; // Base capacity

    for (const chamber of chambers) {
      if (chamber.type === ChamberType.DIGESTIVE_PIT) {
        const def = CHAMBER_DEFINITIONS[ChamberType.DIGESTIVE_PIT];
        capacity += (def.storagePerLevel ?? 1000) * chamber.level;
      }
    }

    return capacity;
  }

  /**
   * Check if heat balance is sustainable.
   * Returns false if consumption exceeds production (starved hive).
   */
  isHeatSustainable(rates: ProductionRates): boolean {
    return rates.heatPerHour >= rates.heatConsumptionPerHour;
  }

  /**
   * Calculate the effective production considering heat starvation.
   * If heat is negative (consumption > production), production scales down proportionally.
   */
  calculateEffectiveProduction(
    rates: ProductionRates,
    currentHeat: number,
  ): ProductionRates {
    const netHeat = rates.heatPerHour - rates.heatConsumptionPerHour;

    // If there's stored heat, it can cover the deficit temporarily
    if (netHeat < 0 && currentHeat > 0) {
      // Stored heat covers the deficit — no scaling needed
      void (currentHeat / Math.abs(netHeat)); // hours of heat remaining
      return { ...rates };
    }

    // If no stored heat AND net heat is negative, scale biomass+water production
    if (netHeat < 0 && currentHeat <= 0) {
      const scaleFactor = Math.max(
        0,
        rates.heatPerHour / Math.max(1, rates.heatConsumptionPerHour),
      );
      return {
        biomassPerHour: rates.biomassPerHour * scaleFactor,
        waterPerHour: rates.waterPerHour * scaleFactor,
        heatPerHour: rates.heatPerHour,
        heatConsumptionPerHour: rates.heatConsumptionPerHour,
      };
    }

    return { ...rates };
  }
}
