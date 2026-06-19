import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UNIT_STATS, ATTRITION_BIOMASS_RETURN } from '@a-raj/shared';

/**
 * Handles unit attrition — checking lifespans and removing expired units.
 *
 * Called during EngineService.updateHiveState() on every hive state fetch.
 * Checks all UnitBatch records for the hive against the current time:
 *  - If the batch has reached or exceeded its lifespan (hatchedAt + lifespan),
 *    delete the batch and recover 10% of its biomass cost.
 *  - Surviving batches are left untouched.
 *
 * Biomass recovery formula:
 *   recovered = deletedCount * unitBiomassCost * ATTRITION_BIOMASS_RETURN (0.1)
 */
@Injectable()
export class AttritionService {
  private readonly logger = new Logger(AttritionService.name);

  /**
   * Process attrition for all unit batches in a hive up to targetTime.
   *
   * @param hiveId - The hive to check expired units for
   * @param targetTime - The current time to check against
   * @param prisma - The PrismaService instance (passed from EngineService)
   * @returns Total biomass recovered from all expired unit batches
   */
  async processAttrition(
    hiveId: string,
    targetTime: Date,
    prisma: PrismaService,
  ): Promise<number> {
    // Find all unit batches for this hive
    const batches = await prisma.unitBatch.findMany({
      where: { hiveId },
    });

    if (batches.length === 0) {
      return 0;
    }

    let totalRecovered = 0;
    const expiredIds: string[] = [];

    for (const batch of batches) {
      const hatchedAt = new Date(batch.hatchedAt);
      const lifespanMs = batch.lifespan * 60 * 60 * 1000; // hours → ms
      const expiryTime = new Date(hatchedAt.getTime() + lifespanMs);

      // Check if the batch has expired
      if (targetTime >= expiryTime) {
        expiredIds.push(batch.id);

        // Calculate biomass recovery: 10% of unit cost * count
        const stats = UNIT_STATS[batch.unitType as keyof typeof UNIT_STATS];
        if (stats) {
          const recovered = batch.count * stats.biomassCost * ATTRITION_BIOMASS_RETURN;
          totalRecovered += recovered;

          this.logger.debug(
            `Attrition: ${batch.count}x ${batch.unitType} expired ` +
              `(hatched ${hatchedAt.toISOString()}, lifespan ${batch.lifespan}h) | ` +
              `+${recovered.toFixed(0)} biomass recovered`,
          );
        }
      }
    }

    // Delete all expired batches in one transaction
    if (expiredIds.length > 0) {
      await prisma.unitBatch.deleteMany({
        where: { id: { in: expiredIds } },
      });

      this.logger.log(
        `Attrition: ${expiredIds.length} batch(es) expired in hive ${hiveId} | ` +
          `+${totalRecovered.toFixed(0)} total biomass recovered`,
      );
    }

    return totalRecovered;
  }
}
