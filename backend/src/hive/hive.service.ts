import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EngineService } from '../engine/engine.service.js';
import { ProductionService } from '../engine/production.service.js';
import {
  ChamberType,
  UnitType,
  MutationType,
  CHAMBER_DEFINITIONS,
  STARTING_RESOURCES,
  MAX_CHAMBERS,
  calculateBuildCost,
  calculateBuildTime,
} from '@a-raj/shared';
import type { HiveData, ChamberData } from '@a-raj/shared';

/**
 * Hive service — manages hive state and chamber upgrades.
 */
@Injectable()
export class HiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engineService: EngineService,
    private readonly productionService: ProductionService,
  ) {}

  /**
   * Create a new hive for a newly registered user.
   * Places the hive at a pseudo-random hex using golden angle spread.
   */
  async createInitialHive(userId: string): Promise<void> {
    const existingHives = await this.prisma.hive.count();
    const angle = (existingHives * 137.5) % 360;
    const radius = 3 + Math.floor(existingHives / 6);
    const q = Math.round(Math.cos((angle * Math.PI) / 180) * radius);
    const r = Math.round(Math.sin((angle * Math.PI) / 180) * radius);

    await this.prisma.hive.create({
      data: {
        userId,
        q,
        r,
        biomass: STARTING_RESOURCES.biomass,
        water: STARTING_RESOURCES.water,
        heat: STARTING_RESOURCES.heat,
        dnaNectar: STARTING_RESOURCES.dnaNectar,
        chambers: {
          create: {
            type: ChamberType.QUEEN,
            level: 1,
          },
        },
      },
    });
  }

  /**
   * Get the current hive state for a user.
   * Runs lazy calculation to bring resources up to date before returning.
   */
  async getHive(userId: string): Promise<HiveData> {
    const hiveInclude = { chambers: true, unitBatches: true, mutations: true };

    let hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: hiveInclude,
    });

    // Lazy creation: if no hive exists yet, create one
    if (!hive) {
      await this.createInitialHive(userId);
      hive = await this.prisma.hive.findFirst({
        where: { userId },
        include: hiveInclude,
      });
    }

    if (!hive) {
      throw new NotFoundException('Failed to create hive');
    }

    // Run lazy calculation to update resources since last visit
    await this.engineService.updateHiveState(hive.id, new Date());

    // Re-fetch after update to get fresh resource values
    const updated = await this.prisma.hive.findUnique({
      where: { id: hive.id },
      include: hiveInclude,
    });

    if (!updated) {
      throw new NotFoundException('Hive vanished');
    }

    const chambers: ChamberData[] = updated.chambers.map((c) => ({
      id: c.id,
      type: c.type as ChamberType,
      level: c.level,
    }));

    const rates = this.productionService.calculateProductionRates(chambers);

    const unitBatches = updated.unitBatches.map((b) => ({
      id: b.id,
      unitType: b.unitType as UnitType,
      count: b.count,
      hatchedAt: b.hatchedAt.toISOString(),
    }));

    const mutations = updated.mutations.map((m) => ({
      id: m.id,
      mutationType: m.mutationType as MutationType,
      level: m.level,
    }));

    return {
      id: updated.id,
      q: updated.q,
      r: updated.r,
      resources: {
        biomass: updated.biomass,
        water: updated.water,
        heat: updated.heat,
        dnaNectar: updated.dnaNectar,
      },
      productionRates: rates,
      chambers,
      unitBatches,
      mutations,
      lastUpdated: updated.lastUpdated.toISOString(),
    };
  }

  /**
   * Upgrade or build a chamber.
   *
   * 1. Validates the chamber type exists
   * 2. Checks chamber count limit
   * 3. Runs lazy calculation to get current resources
   * 4. Calculates and deducts costs
   * 5. Creates or upgrades the chamber instantly
   *    (BullMQ build queue deferred to future sprint)
   */
  async upgradeChamber(
    userId: string,
    chamberType: string,
  ): Promise<{ chamber: ChamberData; resources: { biomass: number; water: number; heat: number; dnaNectar: number } }> {
    // Validate chamber type
    if (!Object.values(ChamberType).includes(chamberType as ChamberType)) {
      throw new BadRequestException(`Invalid chamber type: ${chamberType}`);
    }

    const type = chamberType as ChamberType;
    const def = CHAMBER_DEFINITIONS[type];

    // Get hive with chambers
    let hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { chambers: true },
    });

    if (!hive) {
      throw new NotFoundException('No hive found');
    }

    // Run lazy calculation first
    await this.engineService.updateHiveState(hive.id, new Date());

    // Re-fetch fresh state
    hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { chambers: true },
    });

    if (!hive) {
      throw new NotFoundException('Hive vanished');
    }

    const existing = hive.chambers.find((c) => c.type === chamberType);
    const targetLevel = existing ? existing.level + 1 : 1;

    // Validate max chamber count (for new chambers only)
    if (!existing && hive.chambers.length >= MAX_CHAMBERS) {
      throw new BadRequestException(
        `Maximum chambers reached (${MAX_CHAMBERS})`,
      );
    }

    // Validate max level
    if (targetLevel > def.maxLevel) {
      throw new BadRequestException(
        `${def.name} max level ${def.maxLevel} reached`,
      );
    }

    // Calculate build cost
    const cost = calculateBuildCost(
      def.baseBiomassCost,
      def.baseWaterCost,
      targetLevel,
    );
    // TODO: Use build time with BullMQ job scheduling in future sprint
    const _buildTimeMinutes = calculateBuildTime(
      def.buildTimeMinutes,
      targetLevel,
    );

    // Validate resources
    if (hive.biomass < cost.biomass) {
      throw new BadRequestException(
        `Not enough Biomass. Need ${cost.biomass}, have ${Math.floor(hive.biomass)}`,
      );
    }
    if (hive.water < cost.water) {
      throw new BadRequestException(
        `Not enough Water. Need ${cost.water}, have ${Math.floor(hive.water)}`,
      );
    }

    // Deduct resources and create/upgrade chamber in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Deduct resources
      const updatedHive = await tx.hive.update({
        where: { id: hive!.id },
        data: {
          biomass: { decrement: cost.biomass },
          water: { decrement: cost.water },
        },
      });

      let chamber: ChamberData;

      if (existing) {
        // Upgrade
        const updated = await tx.chamber.update({
          where: { id: existing.id },
          data: { level: targetLevel },
        });
        chamber = {
          id: updated.id,
          type: updated.type as ChamberType,
          level: updated.level,
        };
      } else {
        // Build new
        const created = await tx.chamber.create({
          data: {
            hiveId: hive!.id,
            type: chamberType,
            level: 1,
          },
        });
        chamber = {
          id: created.id,
          type: created.type as ChamberType,
          level: created.level,
        };
      }

      return { chamber, resources: updatedHive };
    });

    return {
      chamber: result.chamber,
      resources: {
        biomass: result.resources.biomass,
        water: result.resources.water,
        heat: result.resources.heat,
        dnaNectar: result.resources.dnaNectar,
      },
    };
  }
}
