import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PveService, PVE_RESPAWN_QUEUE } from './pve.service.js';
import { PveRespawnProcessor } from './pve.processor.js';
import { PveController } from './pve.controller.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: PVE_RESPAWN_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [PveController],
  providers: [PveService, PveRespawnProcessor],
  exports: [PveService],
})
export class PveModule {}
