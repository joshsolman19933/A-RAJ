import { Module } from '@nestjs/common';
import { MovementController } from './movement.controller.js';
import { MovementService } from './movement.service.js';
import { CombatModule } from '../combat/combat.module.js';
import { EngineModule } from '../engine/engine.module.js';
import { PveModule } from '../pve/pve.module.js';

@Module({
  imports: [EngineModule, CombatModule, PveModule],
  controllers: [MovementController],
  providers: [MovementService],
})
export class MovementModule {}
