import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module.js';
import { HiveController } from './hive.controller.js';
import { HiveService } from './hive.service.js';

@Module({
  imports: [EngineModule],
  controllers: [HiveController],
  providers: [HiveService],
  exports: [HiveService],
})
export class HiveModule {}
