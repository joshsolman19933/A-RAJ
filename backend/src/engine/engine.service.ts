import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProductionService } from './production.service.js';
import { AttritionService } from './attrition.service.js';
import { calculateCurrentResources } from '@a-raj/shared';
import type { ChamberData } from '@a-raj/shared';
import { ChamberType } from '@a-raj/shared';

/**
 * The core Lazy Calculation engine.
 *
 * Runs updateHiveState() to bring a hive up-to-date by calculating
 * resource production and unit attrition since lastUpdated.
 *
 * Called on:
 *   - Player login / GET /hive
 *   - Before an incoming attack resolves
 *   - Before building/upgrading a chamber
 *
 * This is the key optimization from the GDD:
 *   "NE cron jobbal frissíts másodpercenként minden fiókot!"
 */
@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productionService: ProductionService,
    private readonly attritionService: AttritionService,
  ) {}

  /**
   * Update hive state to the current time.
   * Fetches hive, calculates elapsed time, updates resources, saves.
   */
  async updateHiveState(
    hiveId: string,
    targetTimestamp: Date = new Date(),
  ): Promise<void> {
    const hive = await this.prisma.hive.findUnique({
      where: { id: hiveId },
      include: { chambers: true },
    });

    if (!hive) {
      this.logger.warn(`Hive ${hiveId} not found for updateHiveState`);
      return;
    }

    const lastUpdated = new Date(hive.lastUpdated);
    const deltaMs = targetTimestamp.getTime() - lastUpdated.getTime();

    // No time elapsed — nothing to do
    if (deltaMs <= 0) return;

    const deltaHours = deltaMs / (1000 * 60 * 60);

    const chambers: ChamberData[] = hive.chambers.map((c) => ({
      id: c.id,
      type: c.type as ChamberType,
      level: c.level,
    }));

    // Calculate production rates
    const rates =
      this.productionService.calculateProductionRates(chambers);

    // Apply heat starvation scaling
    const effectiveRates =
      this.productionService.calculateEffectiveProduction(rates, hive.heat);

    // Calculate storage capacity
    const storageCapacity =
      this.productionService.calculateStorageCapacity(chambers);

    // Calculate resources after time delta
    const currentResources = {
      biomass: hive.biomass,
      water: hive.water,
      heat: hive.heat,
      dnaNectar: hive.dnaNectar,
    };

    const updatedResources = calculateCurrentResources(
      currentResources,
      effectiveRates,
      deltaHours,
      storageCapacity,
    );

    // Process attrition (no-op until Sprint 2.1, but hook is ready)
    const recoveredBiomass = await this.attritionService.processAttrition(
      hiveId,
      targetTimestamp,
      this.prisma,
    );

    // Clamp biomass to storage after adding attrition recovery (can't exceed storage)
    const finalBiomass = Math.min(
      storageCapacity,
      updatedResources.biomass + recoveredBiomass,
    );

    // Save updated state
    await this.prisma.hive.update({
      where: { id: hiveId },
      data: {
        biomass: finalBiomass,
        water: updatedResources.water,
        heat: updatedResources.heat,
        dnaNectar: updatedResources.dnaNectar,
        lastUpdated: targetTimestamp,
      },
    });

    if (deltaHours > 0.01) {
      this.logger.debug(
        `Hive ${hiveId}: +${deltaHours.toFixed(2)}h elapsed | ` +
          `bio: ${hive.biomass.toFixed(0)} → ${updatedResources.biomass.toFixed(0)} | ` +
          `water: ${hive.water.toFixed(0)} → ${updatedResources.water.toFixed(0)} | ` +
          `heat: ${hive.heat.toFixed(0)} → ${updatedResources.heat.toFixed(0)}`,
      );
    }
  }
}
