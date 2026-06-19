import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { EngineService } from '../engine/engine.service.js';
import {
  UnitType,
  AttackType,
  QueenTrainingStatus,
  ChamberType,
  STARTING_RESOURCES,
  UNIT_STATS,
  calculateTravelTime,
  HexType,
} from '@a-raj/shared';
import type { HexCoord, UnitBatchBrief, MovementData } from '@a-raj/shared';

export const SWARM_QUEUE = 'swarm';

interface SwarmEscort {
  unitType: UnitType;
  count: number;
}

/**
 * Service managing the Swarm (Rajzás) mechanic.
 *
 * Flow:
 * 1. User has a READY Queen (QueenTraining completed)
 * 2. User selects an EMPTY target hex and escort army
 * 3. POST /queen/swarm: validates, creates Movement record (SWARM),
 *    removes Queen + escort from hive, schedules BullMQ travel job
 * 4. On arrival: creates new Hive at target with Queen Chamber L1,
 *    marks MapHex as HIVE, consumes escort units
 *
 * The Queen and escort army are vulnerable during travel (removed from hive).
 * The Movement is visible on the map and can be attacked by other players.
 */
@Injectable()
export class SwarmService {
  private readonly logger = new Logger(SwarmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engineService: EngineService,
    @InjectQueue(SWARM_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Initiate a swarm to a target hex with escort units.
   */
  async initiateSwarm(
    userId: string,
    targetQ: number,
    targetR: number,
    escortUnits: SwarmEscort[],
  ): Promise<{ movement: MovementData; swarmId: string }> {
    // 1. Get hive + queen training
    const hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { unitBatches: true },
    });

    if (!hive) {
      throw new NotFoundException('Hive not found');
    }

    await this.engineService.updateHiveState(hive.id);

    // Re-fetch with fresh data
    const freshHive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { unitBatches: true },
    });

    if (!freshHive) {
      throw new NotFoundException('Hive vanished');
    }

    // 2. Verify Queen is READY
    const training = await this.prisma.queenTraining.findUnique({
      where: { hiveId: freshHive.id },
    });

    if (!training || training.status !== QueenTrainingStatus.READY) {
      throw new BadRequestException(
        'No trained Queen is ready. Train a Queen first (POST /queen/train).',
      );
    }

    // Verify Queen UnitBatch exists
    const queenBatch = freshHive.unitBatches.find(
      (b) => b.unitType === UnitType.QUEEN,
    );

    if (!queenBatch || queenBatch.count < 1) {
      throw new BadRequestException(
        'Queen unit not found in hive. The Queen may have been killed.',
      );
    }

    // 3. Validate target hex
    if (targetQ === freshHive.q && targetR === freshHive.r) {
      throw new BadRequestException('Cannot swarm to your own hive location');
    }

    const targetHex = await this.prisma.mapHex.findUnique({
      where: { q_r: { q: targetQ, r: targetR } },
    });

    if (!targetHex) {
      throw new BadRequestException(
        `No hex at (${targetQ}, ${targetR})`,
      );
    }

    if (targetHex.type !== HexType.EMPTY) {
      throw new BadRequestException(
        `Target hex must be EMPTY. Current type: ${targetHex.type}. Only empty hexes can host a new hive.`,
      );
    }

    // 4. Validate escort units
    if (!escortUnits.length) {
      throw new BadRequestException(
        'Must send at least one escort unit with the Queen',
      );
    }

    const unitMap = new Map<string, number>();
    for (const batch of freshHive.unitBatches) {
      unitMap.set(
        batch.unitType,
        (unitMap.get(batch.unitType) ?? 0) + batch.count,
      );
    }

    for (const sel of escortUnits) {
      if (!Object.values(UnitType).includes(sel.unitType)) {
        throw new BadRequestException(`Invalid unit type: ${sel.unitType}`);
      }
      if (sel.unitType === UnitType.QUEEN) {
        throw new BadRequestException(
          'Queen units cannot be selected as escort (the Queen leads automatically)',
        );
      }
      if (sel.count <= 0 || !Number.isInteger(sel.count)) {
        throw new BadRequestException(
          `Count must be a positive integer for ${sel.unitType}`,
        );
      }
      const available = unitMap.get(sel.unitType) ?? 0;
      if (sel.count > available) {
        throw new BadRequestException(
          `Not enough ${sel.unitType}. Requested ${sel.count}, have ${available}`,
        );
      }
    }

    // 5. Calculate travel time (Queen speed = 1, slowest escort also limits)
    const queenSpeed = UNIT_STATS[UnitType.QUEEN].speed; // 1
    const escortSpeeds = escortUnits.map((u) => {
      const stats = UNIT_STATS[u.unitType as UnitType];
      return stats?.speed ?? Infinity;
    });
    const slowestSpeed = Math.min(queenSpeed, ...escortSpeeds);

    if (slowestSpeed <= 0) {
      throw new BadRequestException('Invalid unit speed');
    }

    const travelHours = calculateTravelTime(
      { q: freshHive.q, r: freshHive.r },
      { q: targetQ, r: targetR },
      slowestSpeed,
    );

    if (!isFinite(travelHours) || travelHours <= 0) {
      throw new BadRequestException('Invalid travel time');
    }

    const totalEscortCount = escortUnits.reduce((s, u) => s + u.count, 0);

    this.logger.log(
      `Swarm: hive ${freshHive.id} → (${targetQ},${targetR}) | ` +
        `Queen + ${totalEscortCount} escort units | ` +
        `travel: ${travelHours.toFixed(1)}h at speed ${slowestSpeed}`,
    );

    // 6. Create movement record + remove Queen/escort from hive in $transaction
    const now = new Date();
    const arriveAt = new Date(now.getTime() + travelHours * 3600 * 1000);

    // Combine Queen + escort into the movement's units
    const allUnits: UnitBatchBrief[] = [
      { unitType: UnitType.QUEEN, count: 1 },
      ...escortUnits.map((u) => ({
        unitType: u.unitType as UnitType,
        count: u.count,
      })),
    ];

    const movement = await this.prisma.$transaction(async (tx) => {
      // Create movement record
      const mov = await tx.movement.create({
        data: {
          fromHiveId: freshHive.id,
          attackType: AttackType.SWARM,
          targetQ,
          targetR,
          sentAt: now,
          arriveAt,
          units: allUnits as unknown as object[],
        },
      });

      // Remove Queen UnitBatch (1 Queen)
      const queenBatches = await tx.unitBatch.findMany({
        where: { hiveId: freshHive.id, unitType: UnitType.QUEEN },
      });
      let queenRemaining = 1;
      for (const batch of queenBatches) {
        if (queenRemaining <= 0) break;
        const take = Math.min(batch.count, queenRemaining);
        queenRemaining -= take;
        if (batch.count - take <= 0) {
          await tx.unitBatch.delete({ where: { id: batch.id } });
        } else {
          await tx.unitBatch.update({
            where: { id: batch.id },
            data: { count: batch.count - take },
          });
        }
      }

      if (queenRemaining > 0) {
        throw new BadRequestException(
          'Queen unit count changed during transaction. The Queen may have been killed or already used.',
        );
      }

      // Remove escort units
      for (const sel of escortUnits) {
        let remaining = sel.count;
        const batches = await tx.unitBatch.findMany({
          where: { hiveId: freshHive.id, unitType: sel.unitType },
          orderBy: { hatchedAt: 'asc' },
        });
        for (const batch of batches) {
          if (remaining <= 0) break;
          const take = Math.min(batch.count, remaining);
          remaining -= take;
          if (batch.count - take <= 0) {
            await tx.unitBatch.delete({ where: { id: batch.id } });
          } else {
            await tx.unitBatch.update({
              where: { id: batch.id },
              data: { count: batch.count - take },
            });
          }
        }
      }

      // Mark Queen training as consumed (delete the record so a new one can be trained)
      await tx.queenTraining.delete({
        where: { id: training.id },
      });

      return mov;
    });

    // 7. Schedule BullMQ job for arrival
    const delayMs = arriveAt.getTime() - now.getTime();
    await this.queue.add(
      'complete-swarm',
      {
        movementId: movement.id,
      },
      {
        delay: delayMs,
        jobId: `swarm-${movement.id}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    const movementData: MovementData = {
      id: movement.id,
      attackType: AttackType.SWARM,
      fromHiveId: movement.fromHiveId,
      targetQ: movement.targetQ,
      targetR: movement.targetR,
      units: allUnits,
      sentAt: movement.sentAt.toISOString(),
      arriveAt: movement.arriveAt.toISOString(),
    };

    return { movement: movementData, swarmId: movement.id };
  }

  /**
   * Complete a swarm: create a new hive at the target location.
   * Called by the BullMQ processor when the swarm arrives.
   */
  async completeSwarm(movementId: string): Promise<void> {
    const movement = await this.prisma.movement.findUnique({
      where: { id: movementId },
    });

    if (!movement) {
      this.logger.error(`Swarm movement ${movementId} not found`);
      return;
    }

    if (movement.attackType !== AttackType.SWARM) {
      this.logger.warn(
        `Movement ${movementId} is not a swarm (type: ${movement.attackType})`,
      );
      return;
    }

    const { targetQ, targetR, fromHiveId } = movement;
    const units = movement.units as unknown as UnitBatchBrief[];

    // Get the source hive to find userId
    const sourceHive = await this.prisma.hive.findUnique({
      where: { id: fromHiveId },
    });

    if (!sourceHive) {
      this.logger.error(`Source hive ${fromHiveId} not found for swarm completion`);
      return;
    }

    // Create new hive in $transaction — includes atomic hex-type guard
    await this.prisma.$transaction(async (tx) => {
      // 0. Guard: verify target hex is still EMPTY (TOCTOU-safe inside transaction)
      const hex = await tx.mapHex.findUnique({
        where: { q_r: { q: targetQ, r: targetR } },
      });
      if (!hex) {
        throw new BadRequestException(
          `Target hex (${targetQ},${targetR}) no longer exists`,
        );
      }
      if (hex.type !== HexType.EMPTY) {
        throw new BadRequestException(
          `Target hex is no longer EMPTY (type: ${hex.type}). Another swarm may have arrived first.`,
        );
      }

      // 1. Create new hive with starting resources
      const newHive = await tx.hive.create({
        data: {
          userId: sourceHive.userId,
          q: targetQ,
          r: targetR,
          biomass: STARTING_RESOURCES.biomass,
          water: STARTING_RESOURCES.water,
          heat: STARTING_RESOURCES.heat,
          dnaNectar: STARTING_RESOURCES.dnaNectar,
        },
      });

      // 2. Create Queen Chamber (level 1)
      await tx.chamber.create({
        data: {
          hiveId: newHive.id,
          type: ChamberType.QUEEN,
          level: 1,
        },
      });

      // 3. Mark MapHex as HIVE
      await tx.mapHex.update({
        where: { q_r: { q: targetQ, r: targetR } },
        data: {
          type: HexType.HIVE,
          hiveId: newHive.id,
        },
      });

      // 4. Delete the movement record (swarm completed)
      await tx.movement.delete({ where: { id: movementId } });
    });

    this.logger.log(
      `Swarm completed: new hive at (${targetQ},${targetR}) for user ${sourceHive.userId}`,
    );
  }

  /**
   * Get active swarm movements for a user.
   */
  async getActiveSwarms(userId: string): Promise<MovementData[]> {
    const hive = await this.prisma.hive.findFirst({
      where: { userId },
    });

    if (!hive) {
      throw new NotFoundException('Hive not found');
    }

    const movements = await this.prisma.movement.findMany({
      where: {
        fromHiveId: hive.id,
        attackType: AttackType.SWARM,
      },
      orderBy: { sentAt: 'desc' },
    });

    return movements.map((m) => ({
      id: m.id,
      attackType: m.attackType as AttackType,
      fromHiveId: m.fromHiveId,
      targetQ: m.targetQ,
      targetR: m.targetR,
      units: m.units as unknown as UnitBatchBrief[],
      sentAt: m.sentAt.toISOString(),
      arriveAt: m.arriveAt.toISOString(),
    }));
  }
}
