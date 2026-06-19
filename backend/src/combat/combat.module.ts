import { Module } from '@nestjs/common';
import { CombatService } from './combat.service.js';
import { EngineModule } from '../engine/engine.module.js';
import { PveModule } from '../pve/pve.module.js';

@Module({
  imports: [EngineModule, PveModule],
  providers: [CombatService],
  exports: [CombatService],
})
export class CombatModule {}
