import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EngineModule } from './engine/engine.module.js';
import { HiveModule } from './hive/hive.module.js';
import { MilitaryModule } from './military/military.module.js';
import { MutationModule } from './mutation/mutation.module.js';
import { MapModule } from './map/map.module.js';

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
  ],
})
export class AppModule {}
