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
import {
  IsString,
  IsIn,
  Matches,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ClanService } from './clan.service.js';
import { ClanRole, DiplomacyStatus } from '@a-raj/shared';
import type { ClanData, ClanMemberData } from '@a-raj/shared';

// --- DTOs ---

export class CreateClanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  colorHex?: string;
}

export class JoinClanDto {
  @IsString()
  clanId!: string;
}

export class PromoteDto {
  @IsString()
  targetUserId!: string;

  @IsString()
  @IsIn(Object.values(ClanRole))
  role!: string;
}

export class TradeDto {
  @IsString()
  toUserId!: string;

  @IsString()
  @IsIn(['BIOMASS', 'WATER', 'DNA_NECTAR'])
  resourceType!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class DiplomacyDto {
  @IsString()
  targetClanId!: string;

  @IsString()
  @IsIn(Object.values(DiplomacyStatus))
  status!: string;
}

// --- Response types ---

interface CreateClanResponse {
  clan: ClanData;
  member: ClanMemberData;
}

interface GetClanResponse {
  clan: ClanData;
  members: ClanMemberData[];
}

interface TradeResponse {
  tradeId: string;
  fromBalance: number;
  toBalance: number;
}

interface DiplomacyResponse {
  clanId: string;
  targetClanId: string;
  status: DiplomacyStatus;
}

interface DiplomacyListResponse {
  clanId: string;
  targetClanId: string;
  targetClanName: string;
  targetClanColor: string;
  status: DiplomacyStatus;
  setAt: string;
}

@ApiTags('Clan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clan')
export class ClanController {
  constructor(private readonly clanService: ClanService) {}

  // --- CRUD ---

  @Post('create')
  @ApiOperation({ summary: 'Create a new clan' })
  @ApiResponse({ status: 200, description: 'Clan created' })
  @ApiResponse({ status: 400, description: 'Name taken or already in clan' })
  async create(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: CreateClanDto,
  ): Promise<CreateClanResponse> {
    return this.clanService.createClan(
      req.user.userId,
      dto.name,
      dto.description ?? '',
      dto.colorHex ?? '#cc3333',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get clan details with members' })
  async getClan(@Param('id') clanId: string): Promise<GetClanResponse> {
    return this.clanService.getClan(clanId);
  }

  // --- Membership ---

  @Post('join')
  @ApiOperation({ summary: 'Join a clan' })
  @ApiResponse({ status: 200, description: 'Joined clan' })
  @ApiResponse({ status: 400, description: 'Already in a clan' })
  async join(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: JoinClanDto,
  ): Promise<ClanMemberData> {
    return this.clanService.joinClan(req.user.userId, dto.clanId);
  }

  @Post('leave')
  @ApiOperation({ summary: 'Leave your clan' })
  async leave(
    @Req() req: Request & { user: { userId: string } },
  ): Promise<{ message: string }> {
    await this.clanService.leaveClan(req.user.userId);
    return { message: 'Left clan successfully' };
  }

  @Post('promote')
  @ApiOperation({ summary: 'Promote or demote a clan member (Leader only)' })
  @ApiResponse({ status: 200, description: 'Member promoted' })
  @ApiResponse({ status: 403, description: 'Not the leader' })
  async promote(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: PromoteDto,
  ): Promise<ClanMemberData> {
    return this.clanService.promoteMember(
      req.user.userId,
      dto.targetUserId,
      dto.role as ClanRole,
    );
  }

  // --- Trading ---

  @Post('trade')
  @ApiOperation({ summary: 'Send resources to a clan member' })
  @ApiResponse({ status: 200, description: 'Trade completed' })
  @ApiResponse({ status: 400, description: 'Not in same clan or insufficient resources' })
  async trade(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: TradeDto,
  ): Promise<TradeResponse> {
    return this.clanService.tradeResources(
      req.user.userId,
      dto.toUserId,
      dto.resourceType,
      dto.amount,
    );
  }

  // --- Diplomacy ---

  @Post('diplomacies')
  @ApiOperation({ summary: 'Set diplomacy status with another clan (Leader/Officer only)' })
  @ApiResponse({ status: 200, description: 'Diplomacy set' })
  @ApiResponse({ status: 403, description: 'Not Leader or Officer' })
  async setDiplomacy(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: DiplomacyDto,
  ): Promise<DiplomacyResponse> {
    return this.clanService.setDiplomacy(
      req.user.userId,
      dto.targetClanId,
      dto.status as DiplomacyStatus,
    );
  }

  @Get('diplomacies')
  @ApiOperation({ summary: 'Get all diplomacy relations for your clan' })
  async getDiplomacies(
    @Req() req: Request & { user: { userId: string } },
  ): Promise<DiplomacyListResponse[]> {
    return this.clanService.getDiplomaciesForUser(req.user.userId);
  }
}
