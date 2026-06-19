import { Module } from '@nestjs/common';
import { PheromoneController } from './pheromone.controller.js';
import { PheromoneService } from './pheromone.service.js';

@Module({
  controllers: [PheromoneController],
  providers: [PheromoneService],
})
export class PheromoneModule {}
