import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SwarmService, SWARM_QUEUE } from './swarm.service.js';
import type { UnitBatchBrief } from '@a-raj/shared';

interface SwarmJob {
  movementId: string;
  targetQ: number;
  targetR: number;
  userId: string;
  escortUnits: UnitBatchBrief[];
}

/**
 * BullMQ worker that handles swarm arrival.
 *
 * When the delayed job fires (after travel time), it calls
 * SwarmService.completeSwarm() to create the new hive.
 */
@Processor(SWARM_QUEUE)
export class SwarmProcessor extends WorkerHost {
  private readonly logger = new Logger(SwarmProcessor.name);

  constructor(private readonly swarmService: SwarmService) {
    super();
  }

  async process(job: Job<SwarmJob>): Promise<void> {
    const { movementId, targetQ, targetR } = job.data;

    this.logger.log(
      `Processing swarm arrival for movement ${movementId} at (${targetQ},${targetR})`,
    );

    try {
      await this.swarmService.completeSwarm(movementId);
      this.logger.log(`Swarm ${movementId} successfully completed`);
    } catch (err) {
      this.logger.error(
        `Failed to complete swarm ${movementId}`,
        (err as Error).stack,
      );
      throw err;
    }
  }
}
