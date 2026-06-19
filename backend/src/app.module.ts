import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EngineModule } from './engine/engine.module.js';
import { HiveModule } from './hive/hive.module.js';
import { MilitaryModule } from './military/military.module.js';
import { MutationModule } from './mutation/mutation.module.js';
import { MapModule } from './map/map.module.js';
import { MovementModule } from './movement/movement.module.js';
import { ClanModule } from './clan/clan.module.js';
import { WsModule } from './ws/ws.module.js';
import { PheromoneModule } from './pheromone/pheromone.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    EngineModule,
    HiveModule,
    MilitaryModule,
    MutationModule,
    MapModule,
    MovementModule,
    ClanModule,
    WsModule,
    PheromoneModule,
  ],
})
export class AppModule {}
