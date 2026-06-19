import { Module } from '@nestjs/common';
import { CombatService } from './combat.service.js';
import { EngineModule } from '../engine/engine.module.js';

@Module({
  imports: [EngineModule],
  providers: [CombatService],
  exports: [CombatService],
})
export class CombatModule {}
