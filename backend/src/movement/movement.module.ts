import { Module } from '@nestjs/common';
import { MovementController } from './movement.controller.js';
import { MovementService } from './movement.service.js';
import { CombatModule } from '../combat/combat.module.js';
import { EngineModule } from '../engine/engine.module.js';

@Module({
  imports: [EngineModule, CombatModule],
  controllers: [MovementController],
  providers: [MovementService],
})
export class MovementModule {}
