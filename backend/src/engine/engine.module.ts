import { Module } from '@nestjs/common';
import { EngineService } from './engine.service.js';
import { ProductionService } from './production.service.js';
import { AttritionService } from './attrition.service.js';

@Module({
  providers: [EngineService, ProductionService, AttritionService],
  exports: [EngineService, ProductionService],
})
export class EngineModule {}
