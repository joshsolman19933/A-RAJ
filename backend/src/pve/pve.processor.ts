import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PveService, PVE_RESPAWN_QUEUE } from './pve.service.js';

/**
 * BullMQ processor for PvE nest respawn jobs.
 * When a PvE nest is defeated, a delayed job is scheduled.
 * When the job fires, the nest is respawned.
 */
@Processor(PVE_RESPAWN_QUEUE)
export class PveRespawnProcessor extends WorkerHost {
  private readonly logger = new Logger(PveRespawnProcessor.name);

  constructor(private readonly pveService: PveService) {
    super();
  }

  async process(job: Job<{ nestId: string; q: number; r: number }>): Promise<void> {
    const { nestId, q, r } = job.data;

    this.logger.log(`Respawning PvE nest ${nestId} at (${q},${r})`);

    try {
      await this.pveService.respawnNest(nestId);
      this.logger.log(`PvE nest ${nestId} at (${q},${r}) respawned successfully`);
    } catch (err) {
      this.logger.error(`Failed to respawn PvE nest ${nestId}: ${err}`);
      throw err; // Re-throw for BullMQ retry
    }
  }
}
