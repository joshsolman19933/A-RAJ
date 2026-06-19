import {
  Controller,
  Post,
  Get,
  Req,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { QueenTrainingService } from './queen-training.service.js';
import { SwarmService } from './swarm.service.js';
import type { UnitType } from '@a-raj/shared';

interface AuthenticatedRequest {
  user: { userId: string; username: string; premiumTier: string };
}

class SwarmDto {
  targetQ!: number;
  targetR!: number;
  escortUnits!: Array<{ unitType: UnitType; count: number }>;
}

/**
 * Queen Controller.
 *
 * Endpoints:
 * - POST /queen/train        – Start Queen training
 * - GET  /queen/status        – Get current training status
 * - POST /queen/swarm         – Launch swarm to a target hex
 * - GET  /queen/swarm/status   – Get active swarm movements
 */
@Controller('queen')
@UseGuards(JwtAuthGuard)
export class QueenController {
  constructor(
    private readonly queenTrainingService: QueenTrainingService,
    private readonly swarmService: SwarmService,
  ) {}

  @Post('train')
  @HttpCode(HttpStatus.OK)
  async train(@Req() req: AuthenticatedRequest) {
    return this.queenTrainingService.trainQueen(req.user.userId);
  }

  @Get('status')
  async getStatus(@Req() req: AuthenticatedRequest) {
    const status = await this.queenTrainingService.getStatus(req.user.userId);
    if (!status) {
      return { status: null };
    }
    return { status };
  }

  @Post('swarm')
  @HttpCode(HttpStatus.OK)
  async swarm(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SwarmDto,
  ) {
    return this.swarmService.initiateSwarm(
      req.user.userId,
      dto.targetQ,
      dto.targetR,
      dto.escortUnits,
    );
  }

  @Get('swarm/status')
  async getSwarmStatus(@Req() req: AuthenticatedRequest) {
    const movements = await this.swarmService.getActiveSwarms(req.user.userId);
    return { movements };
  }
}
