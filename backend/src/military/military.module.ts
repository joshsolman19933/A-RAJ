import { Module } from '@nestjs/common';
import { MilitaryController } from './military.controller.js';
import { MilitaryService } from './military.service.js';
import { EngineModule } from '../engine/engine.module.js';

@Module({
  imports: [EngineModule],
  controllers: [MilitaryController],
  providers: [MilitaryService],
})
export class MilitaryModule {}
