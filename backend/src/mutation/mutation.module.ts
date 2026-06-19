import { Module } from '@nestjs/common';
import { MutationController } from './mutation.controller.js';
import { MutationService } from './mutation.service.js';
import { EngineModule } from '../engine/engine.module.js';

@Module({
  imports: [EngineModule],
  controllers: [MutationController],
  providers: [MutationService],
})
export class MutationModule {}
