import {
  Controller,
  Get,
  Post,
  Body,
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
import {
  IsString,
  IsIn,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MovementService } from './movement.service.js';
import { AttackType, UnitType } from '@a-raj/shared';
import type { MovementData, UnitBatchBrief, CombatReport } from '@a-raj/shared';

// --- DTOs ---

export class UnitSelectionDto {
  @IsString()
  @IsIn(Object.values(UnitType))
  unitType!: string;

  @IsInt()
  @Min(1)
  count!: number;
}

export class SendMovementDto {
  @IsString()
  @IsIn(Object.values(AttackType))
  attackType!: string;

  @IsInt()
  targetQ!: number;

  @IsInt()
  targetR!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UnitSelectionDto)
  units!: UnitSelectionDto[];
}

// --- Response types ---

interface SendMovementResponse {
  movement: MovementData;
  combatReport: CombatReport;
}

@ApiTags('Movement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('movement')
export class MovementController {
  constructor(private readonly movementService: MovementService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get active movements for your hive' })
  @ApiResponse({ status: 200, description: 'List of active movements' })
  async getActive(
    @Req() req: Request & { user: { userId: string } },
  ): Promise<MovementData[]> {
    return this.movementService.getActiveMovements(req.user.userId);
  }

  @Post('send')
  @ApiOperation({
    summary: 'Send units to attack a target (resolves instantly)',
  })
  @ApiResponse({ status: 200, description: 'Combat resolved' })
  @ApiResponse({
    status: 400,
    description: 'Invalid target, insufficient units',
  })
  async send(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: SendMovementDto,
  ): Promise<SendMovementResponse> {
    const unitSelections: UnitBatchBrief[] = dto.units.map((u) => ({
      unitType: u.unitType as UnitType,
      count: u.count,
    }));

    return this.movementService.sendMovement(
      req.user.userId,
      dto.attackType,
      dto.targetQ,
      dto.targetR,
      unitSelections,
    );
  }
}
