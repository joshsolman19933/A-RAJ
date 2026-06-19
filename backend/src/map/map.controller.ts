import { Controller, Get, Query, UseGuards, Req, type Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MapService } from './map.service.js';
import type { MapHexData } from '@a-raj/shared';
import { BadRequestException } from '@nestjs/common';

@ApiTags('Map')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('viewport')
  @ApiOperation({ summary: 'Get map hexes within a viewport bounding box' })
  @ApiResponse({ status: 200, description: 'Array of map hexes with hive info' })
  async getViewport(
    @Req() _req: Request & { user: { userId: string } },
    @Query('qMin') qMinStr: string,
    @Query('qMax') qMaxStr: string,
    @Query('rMin') rMinStr: string,
    @Query('rMax') rMaxStr: string,
  ): Promise<MapHexData[]> {
    const qMin = parseInt(qMinStr, 10);
    const qMax = parseInt(qMaxStr, 10);
    const rMin = parseInt(rMinStr, 10);
    const rMax = parseInt(rMaxStr, 10);

    if (isNaN(qMin) || isNaN(qMax) || isNaN(rMin) || isNaN(rMax)) {
      throw new BadRequestException(
        'qMin, qMax, rMin, rMax query parameters are required and must be integers',
      );
    }

    // Limit viewport size to prevent excessive queries (max 50x50 = 2500 hexes)
    const maxSpan = 50;
    if (qMax - qMin > maxSpan || rMax - rMin > maxSpan) {
      throw new BadRequestException(
        `Viewport span cannot exceed ${maxSpan} in any direction`,
      );
    }

    return this.mapService.getViewport(qMin, qMax, rMin, rMax);
  }
}
