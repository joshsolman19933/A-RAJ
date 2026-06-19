import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PveService } from './pve.service.js';
import type { PveNestData } from '@a-raj/shared';

/**
 * PvE Controller.
 *
 * Endpoints:
 * - GET /pve/nests?qMin=&qMax=&rMin=&rMax=  – List PvE nests in viewport
 */
@Controller('pve')
@UseGuards(JwtAuthGuard)
export class PveController {
  constructor(private readonly pveService: PveService) {}

  @Get('nests')
  async getNests(
    @Query('qMin') qMin: string,
    @Query('qMax') qMax: string,
    @Query('rMin') rMin: string,
    @Query('rMax') rMax: string,
  ): Promise<PveNestData[]> {
    const qMinN = isNaN(parseInt(qMin, 10)) ? -50 : parseInt(qMin, 10);
    const qMaxN = isNaN(parseInt(qMax, 10)) ? 50 : parseInt(qMax, 10);
    const rMinN = isNaN(parseInt(rMin, 10)) ? -50 : parseInt(rMin, 10);
    const rMaxN = isNaN(parseInt(rMax, 10)) ? 50 : parseInt(rMax, 10);
    return this.pveService.getNests(qMinN, qMaxN, rMinN, rMaxN);
  }
}
