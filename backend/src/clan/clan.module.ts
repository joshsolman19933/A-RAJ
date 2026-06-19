import { Module } from '@nestjs/common';
import { ClanController } from './clan.controller.js';
import { ClanService } from './clan.service.js';

@Module({
  controllers: [ClanController],
  providers: [ClanService],
})
export class ClanModule {}
