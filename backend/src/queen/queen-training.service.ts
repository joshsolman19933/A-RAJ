import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import type { QueenTrainingData } from '@a-raj/shared';
import {
  UNIT_STATS,
  QUEEN_DNA_NECTAR_COST,
  QUEEN_MIN_HATCHERY_LEVEL,
} from '@a-raj/shared';
import { UnitType, ChamberType, QueenTrainingStatus } from '@a-raj/shared';

export const QUEEN_TRAINING_QUEUE = 'queen-training';

/**
 * Service managing Queen training lifecycle.
 *
 * Requirements:
 * - Hatchery chamber must be at least level QUEEN_MIN_HATCHERY_LEVEL (5)
 * - Costs: Biomasse 5000 + Water 2000 + Heat 1000 + DNA Nectar 500
 * - Training time: 480 minutes (8 hours) from UNIT_STATS.QUEEN.hatchTimeMinutes
 * - One Queen training per hive at a time (enforced by @@unique hiveId)
 * - Uses BullMQ to schedule completion
 */
@Injectable()
export class QueenTrainingService {
  private readonly logger = new Logger(QueenTrainingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEEN_TRAINING_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Start training a new Queen.
   */
  async trainQueen(userId: string): Promise<QueenTrainingData> {
    // Get hive
    const hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { chambers: true },
    });

    if (!hive) {
      throw new NotFoundException('Hive not found');
    }

    // Check Hatchery level
    const hatchery = hive.chambers.find(
      (c) => c.type === ChamberType.HATCHERY,
    );
    if (!hatchery || hatchery.level < QUEEN_MIN_HATCHERY_LEVEL) {
      throw new BadRequestException(
        `Hatchery must be at least level ${QUEEN_MIN_HATCHERY_LEVEL} to train a Queen`,
      );
    }

    // Check if already training
    const existing = await this.prisma.queenTraining.findUnique({
      where: { hiveId: hive.id },
    });
    if (existing && existing.status === QueenTrainingStatus.TRAINING) {
      throw new BadRequestException(
        'A Queen is already being trained in this hive',
      );
    }
    if (existing && existing.status === QueenTrainingStatus.READY) {
      throw new BadRequestException(
        'A fully trained Queen is ready. Deploy her before training a new one.',
      );
    }

    // Calculate completion time
    const queenStats = UNIT_STATS[UnitType.QUEEN];
    const hatchMinutes = queenStats.hatchTimeMinutes; // 480
    const now = new Date();
    const completesAt = new Date(now.getTime() + hatchMinutes * 60 * 1000);

    // Create training record and deduct resources in a transaction
    // Resource check is INSIDE the transaction to prevent TOCTOU (same pattern as ClanService.tradeResources)
    const training = await this.prisma.$transaction(async (tx) => {
      // Re-read hive inside transaction for atomic balance check
      const currentHive = await tx.hive.findUnique({
        where: { id: hive.id },
      });
      if (!currentHive) {
        throw new NotFoundException('Hive not found');
      }

      // Validate resources atomically (TOCTOU-safe)
      const checks: Array<[number, number, string]> = [
        [currentHive.biomass, queenStats.biomassCost, 'Biomass'],
        [currentHive.water, queenStats.waterCost, 'Water'],
        [currentHive.heat, queenStats.heatCost, 'Heat'],
        [currentHive.dnaNectar, QUEEN_DNA_NECTAR_COST, 'DNA Nectar'],
      ];
      for (const [have, need, name] of checks) {
        if (have < need) {
          throw new BadRequestException(
            `Not enough ${name}. Have ${Math.floor(have)}, need ${need}.`,
          );
        }
      }

      // Deduct resources atomically
      await tx.hive.update({
        where: { id: hive.id },
        data: {
          biomass: { decrement: queenStats.biomassCost },
          water: { decrement: queenStats.waterCost },
          heat: { decrement: queenStats.heatCost },
          dnaNectar: { decrement: QUEEN_DNA_NECTAR_COST },
        },
      });

      // Delete old completed/cancelled records (clean up)
      await tx.queenTraining.deleteMany({
        where: {
          hiveId: hive.id,
          status: { in: [QueenTrainingStatus.READY, QueenTrainingStatus.CANCELLED] },
        },
      });

      // Create training record
      return tx.queenTraining.create({
        data: {
          hiveId: hive.id,
          status: QueenTrainingStatus.TRAINING,
          completesAt,
        },
      });
    });

    // Schedule BullMQ job for completion
    const delayMs = completesAt.getTime() - now.getTime();
    const job = await this.queue.add(
      'complete-queen-training',
      {
        trainingId: training.id,
        hiveId: hive.id,
      },
      {
        delay: delayMs,
        jobId: `queen-${training.id}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    // Save job ID for cancellation support
    await this.prisma.queenTraining.update({
      where: { id: training.id },
      data: { jobId: job.id ?? null },
    });

    this.logger.log(
      `Queen training started in hive ${hive.id}, completes at ${completesAt.toISOString()}`,
    );

    return {
      id: training.id,
      hiveId: training.hiveId,
      status: QueenTrainingStatus.TRAINING,
      startedAt: training.startedAt.toISOString(),
      completesAt: training.completesAt.toISOString(),
    };
  }

  /**
   * Get the current Queen training status for a user.
   */
  async getStatus(userId: string): Promise<QueenTrainingData | null> {
    const hive = await this.prisma.hive.findFirst({
      where: { userId },
    });

    if (!hive) {
      throw new NotFoundException('Hive not found');
    }

    const training = await this.prisma.queenTraining.findUnique({
      where: { hiveId: hive.id },
    });

    if (!training) {
      return null;
    }

    return {
      id: training.id,
      hiveId: training.hiveId,
      status: training.status as QueenTrainingStatus,
      startedAt: training.startedAt.toISOString(),
      completesAt: training.completesAt.toISOString(),
      completedAt: training.completedAt?.toISOString(),
    };
  }

  /**
   * Mark a completed Queen training as finished by the BullMQ processor.
   * Creates a QUEEN UnitBatch and updates training status to READY.
   */
  async completeTraining(trainingId: string): Promise<void> {
    const training = await this.prisma.queenTraining.findUnique({
      where: { id: trainingId },
    });

    if (!training) {
      this.logger.error(`Queen training ${trainingId} not found`);
      return;
    }

    if (training.status !== QueenTrainingStatus.TRAINING) {
      this.logger.warn(
        `Queen training ${trainingId} already in status ${training.status}`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Mark training as completed
      await tx.queenTraining.update({
        where: { id: trainingId },
        data: {
          status: QueenTrainingStatus.READY,
          completedAt: new Date(),
        },
      });

      // Create a QUEEN UnitBatch (immortal until settled or killed)
      await tx.unitBatch.create({
        data: {
          hiveId: training.hiveId,
          unitType: UnitType.QUEEN,
          count: 1,
          hatchedAt: new Date(),
          lifespan: 0,
        },
      });
    });

    this.logger.log(
      `Queen training ${trainingId} completed for hive ${training.hiveId}`,
    );
  }
}
