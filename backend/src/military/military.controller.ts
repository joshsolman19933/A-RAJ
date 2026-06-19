import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  type Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MilitaryService } from './military.service.js';
import { UnitType } from '@a-raj/shared';
import type { UnitBatchData } from '@a-raj/shared';

export class HatchDto {
  @IsString()
  @IsIn(Object.values(UnitType))
  unitType!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  count!: number;
}

interface HatchResponse {
  batch: UnitBatchData;
  resources: {
    biomass: number;
    water: number;
    heat: number;
    dnaNectar: number;
  };
}

@ApiTags('Military')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('military')
export class MilitaryController {
  constructor(private readonly militaryService: MilitaryService) {}

  @Get('units')
  @ApiOperation({ summary: 'Get all unit batches for your hive' })
  @ApiResponse({ status: 200, description: 'List of unit batches' })
  async getUnits(
    @Req() req: Request & { user: { userId: string } },
  ): Promise<UnitBatchData[]> {
    return this.militaryService.getUnits(req.user.userId);
  }

  @Post('hatch')
  @ApiOperation({ summary: 'Hatch a batch of units (instant)' })
  @ApiResponse({ status: 200, description: 'Units hatched successfully' })
  @ApiResponse({ status: 400, description: 'Invalid unit type, insufficient resources, or missing Hatchery' })
  async hatch(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: HatchDto,
  ): Promise<HatchResponse> {
    return this.militaryService.hatchUnits(
      req.user.userId,
      dto.unitType,
      dto.count,
    );
  }
}
