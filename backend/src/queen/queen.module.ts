import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EngineModule } from '../engine/engine.module.js';
import { QueenController } from './queen.controller.js';
import { QueenTrainingService, QUEEN_TRAINING_QUEUE } from './queen-training.service.js';
import { QueenTrainingProcessor } from './queen-training.processor.js';
import { SwarmService, SWARM_QUEUE } from './swarm.service.js';
import { SwarmProcessor } from './swarm.processor.js';

@Module({
  imports: [
    EngineModule,
    BullModule.registerQueue({
      name: QUEEN_TRAINING_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    BullModule.registerQueue({
      name: SWARM_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [QueenController],
  providers: [QueenTrainingService, QueenTrainingProcessor, SwarmService, SwarmProcessor],
  exports: [QueenTrainingService, SwarmService],
})
export class QueenModule {}
