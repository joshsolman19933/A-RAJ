import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EngineService } from '../engine/engine.service.js';
import {
  UnitType,
  UNIT_STATS,
  ChamberType,
  calculateHatchTime,
} from '@a-raj/shared';
import type { UnitBatchData } from '@a-raj/shared';

/**
 * Military service — handles unit hatching and army queries.
 *
 * Hatch is instant for now (BullMQ deferred to a future sprint).
 * The service validates:
 *  - Unit type exists
 *  - Hatchery chamber exists
 *  - Sufficient resources (biomass, water, heat)
 *  - Heat consumption feasibility
 */
@Injectable()
export class MilitaryService {
  private readonly logger = new Logger(MilitaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engineService: EngineService,
  ) {}

  /**
   * Get all unit batches for the user's hive.
   */
  async getUnits(userId: string): Promise<UnitBatchData[]> {
    const hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { unitBatches: true },
    });

    if (!hive) {
      throw new NotFoundException('No hive found');
    }

    return hive.unitBatches.map((b) => ({
      id: b.id,
      unitType: b.unitType as UnitType,
      count: b.count,
      hatchedAt: b.hatchedAt.toISOString(),
    }));
  }

  /**
   * Hatch a batch of units instantly.
   *
   * @param userId - The authenticated user
   * @param unitTypeStr - The unit type string (validated against UnitType enum)
   * @param requestedCount - How many units to hatch
   * @returns Created batch data and remaining resources
   */
  async hatchUnits(
    userId: string,
    unitTypeStr: string,
    requestedCount: number,
  ): Promise<{
    batch: UnitBatchData;
    resources: {
      biomass: number;
      water: number;
      heat: number;
      dnaNectar: number;
    };
  }> {
    // 1. Validate unit type
    if (!Object.values(UnitType).includes(unitTypeStr as UnitType)) {
      throw new BadRequestException(`Invalid unit type: ${unitTypeStr}`);
    }
    const unitType = unitTypeStr as UnitType;

    // Prevent hatching Queen units via the normal Hatchery
    if (unitType === UnitType.QUEEN) {
      throw new BadRequestException(
        'Queen units cannot be hatched in the Hatchery. Use the Queen training system.',
      );
    }

    if (requestedCount < 1 || !Number.isInteger(requestedCount)) {
      throw new BadRequestException('Count must be a positive integer');
    }

    const stats = UNIT_STATS[unitType];
    if (!stats) {
      throw new BadRequestException(`Unknown unit type: ${unitType}`);
    }

    // 2. Get hive with chambers
    let hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { chambers: true },
    });

    if (!hive) {
      throw new NotFoundException('No hive found');
    }

    // 3. Run lazy calculation to get current resources
    await this.engineService.updateHiveState(hive.id, new Date());

    // Re-fetch fresh state
    hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { chambers: true },
    });

    if (!hive) {
      throw new NotFoundException('Hive vanished');
    }

    // 4. Check Hatchery chamber exists
    const hatchery = hive.chambers.find(
      (c) => c.type === ChamberType.HATCHERY,
    );

    if (!hatchery) {
      throw new BadRequestException(
        'No Hatchery chamber found. Build a Hatchery first.',
      );
    }

    // 5. Calculate total costs
    const totalBiomassCost = stats.biomassCost * requestedCount;
    const totalWaterCost = stats.waterCost * requestedCount;
    const totalHeatCost = stats.heatCost * requestedCount;

    // 6. Validate resources
    if (hive.biomass < totalBiomassCost) {
      throw new BadRequestException(
        `Not enough Biomass. Need ${totalBiomassCost}, have ${Math.floor(hive.biomass)}`,
      );
    }
    if (hive.water < totalWaterCost) {
      throw new BadRequestException(
        `Not enough Water. Need ${totalWaterCost}, have ${Math.floor(hive.water)}`,
      );
    }
    if (hive.heat < totalHeatCost) {
      throw new BadRequestException(
        `Not enough Heat. Need ${totalHeatCost}, have ${Math.floor(hive.heat)}`,
      );
    }

    // 7. Calculate hatch time for logging (instant for now)
    const hatchMinutes = calculateHatchTime(unitType, hatchery.level);

    // 8. Create UnitBatch and deduct resources in a transaction
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // Deduct resources
      const updatedHive = await tx.hive.update({
        where: { id: hive!.id },
        data: {
          biomass: { decrement: totalBiomassCost },
          water: { decrement: totalWaterCost },
          heat: { decrement: totalHeatCost },
        },
      });

      // Create the unit batch (instant hatch)
      const batch = await tx.unitBatch.create({
        data: {
          hiveId: hive!.id,
          unitType,
          count: requestedCount,
          hatchedAt: now,
          lifespan: stats.lifespanHours,
        },
      });

      return { batch, resources: updatedHive };
    });

    this.logger.log(
      `Hatched ${requestedCount}x ${unitType} in hive ${hive.id} ` +
        `(Hatchery lv${hatchery.level}, effective time: ${hatchMinutes}min) | ` +
        `Cost: ${totalBiomassCost} bio, ${totalWaterCost} water, ${totalHeatCost} heat`,
    );

    return {
      batch: {
        id: result.batch.id,
        unitType: result.batch.unitType as UnitType,
        count: result.batch.count,
        hatchedAt: result.batch.hatchedAt.toISOString(),
      },
      resources: {
        biomass: result.resources.biomass,
        water: result.resources.water,
        heat: result.resources.heat,
        dnaNectar: result.resources.dnaNectar,
      },
    };
  }
}
