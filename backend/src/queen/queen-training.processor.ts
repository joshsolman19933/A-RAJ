import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QueenTrainingService, QUEEN_TRAINING_QUEUE } from './queen-training.service.js';

interface QueenTrainingJob {
  trainingId: string;
  hiveId: string;
}

/**
 * BullMQ worker that handles Queen training completion.
 *
 * When the delayed job fires (after 8 hours), it calls
 * QueenTrainingService.completeTraining() to mark the training
 * as READY and create the QUEEN UnitBatch.
 */
@Processor(QUEEN_TRAINING_QUEUE)
export class QueenTrainingProcessor extends WorkerHost {
  private readonly logger = new Logger(QueenTrainingProcessor.name);

  constructor(private readonly queenTrainingService: QueenTrainingService) {
    super();
  }

  async process(job: Job<QueenTrainingJob>): Promise<void> {
    const { trainingId, hiveId } = job.data;

    this.logger.log(
      `Processing Queen training completion for training ${trainingId}, hive ${hiveId}`,
    );

    try {
      await this.queenTrainingService.completeTraining(trainingId);
      this.logger.log(
        `Queen training ${trainingId} successfully completed`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to complete Queen training ${trainingId}`,
        (err as Error).stack,
      );
      throw err; // Re-throw to trigger BullMQ retry
    }
  }
}
