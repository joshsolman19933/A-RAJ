import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Query,
  type Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { HiveService } from './hive.service.js';
import { ChamberType } from '@a-raj/shared';
import type { HiveData, HiveBrief, ChamberData } from '@a-raj/shared';

export class UpgradeChamberDto {
  @IsString()
  @IsIn(Object.values(ChamberType))
  chamberType!: string;
}

interface UpgradeChamberResponse {
  chamber: ChamberData;
  resources: {
    biomass: number;
    water: number;
    heat: number;
    dnaNectar: number;
  };
}

@ApiTags('Hive')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hive')
export class HiveController {
  constructor(private readonly hiveService: HiveService) {}

  @Get()
  @ApiOperation({ summary: 'Get current hive state (runs lazy resource calculation)' })
  @ApiResponse({ status: 200, description: 'Hive state with updated resources' })
  async getHive(
    @Req() req: Request & { user: { userId: string } },
    @Query('hiveId') hiveId?: string,
  ): Promise<HiveData> {
    return this.hiveService.getHive(req.user.userId, hiveId);
  }

  @Get('list')
  @ApiOperation({ summary: 'List all hives for the current user' })
  @ApiResponse({ status: 200, description: 'List of hive summaries' })
  async listHives(@Req() req: Request & { user: { userId: string } }): Promise<HiveBrief[]> {
    return this.hiveService.getAllHives(req.user.userId);
  }

  @Post('upgrade')
  @ApiOperation({ summary: 'Upgrade or build a chamber' })
  @ApiResponse({ status: 200, description: 'Chamber built/upgraded' })
  @ApiResponse({ status: 400, description: 'Insufficient resources or invalid type' })
  async upgrade(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: UpgradeChamberDto,
  ): Promise<UpgradeChamberResponse> {
    return this.hiveService.upgradeChamber(req.user.userId, dto.chamberType);
  }
}
