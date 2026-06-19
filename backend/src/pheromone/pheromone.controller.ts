import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  type Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { IsArray, IsString, IsIn, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PheromoneService } from './pheromone.service.js';
import { PheromoneType } from '@a-raj/shared';
import type { PheromoneTrailData } from '@a-raj/shared';

// --- DTOs ---

class HexCoordDto {
  q!: number;
  r!: number;
}

export class DrawTrailDto {
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => HexCoordDto)
  path!: HexCoordDto[];

  @IsString()
  @IsIn(Object.values(PheromoneType))
  type!: string;
}

@ApiTags('Pheromone')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pheromone')
export class PheromoneController {
  constructor(private readonly pheromoneService: PheromoneService) {}

  @Get('active/:clanId')
  @ApiOperation({ summary: 'Get active pheromone trails for a clan' })
  async getActive(
    @Param('clanId') clanId: string,
  ): Promise<PheromoneTrailData[]> {
    return this.pheromoneService.getActiveTrails(clanId);
  }

  @Post('draw')
  @ApiOperation({ summary: 'Draw a new pheromone trail (Leader/Officer only)' })
  @ApiResponse({ status: 200, description: 'Trail saved and broadcast' })
  @ApiResponse({ status: 400, description: 'Invalid path or not authorized' })
  async draw(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: DrawTrailDto,
  ): Promise<PheromoneTrailData> {
    return this.pheromoneService.drawTrail(
      req.user.userId,
      dto.path,
      dto.type as PheromoneType,
    );
  }
}
