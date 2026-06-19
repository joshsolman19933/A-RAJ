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
import { IsString, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MutationService } from './mutation.service.js';
import { MutationType, UnitType } from '@a-raj/shared';
import type { MutationData, MutationTreeNode } from '@a-raj/shared';

export class ResearchDto {
  @IsString()
  @IsIn(Object.values(MutationType))
  mutationType!: string;
}

interface ResearchResponse {
  mutation: MutationData;
  resources: {
    biomass: number;
    water: number;
    heat: number;
    dnaNectar: number;
  };
  unlockedUnits: UnitType[];
}

type TreeResponse = (MutationTreeNode & {
  researchedLevel: number;
  unlocksUnit?: UnitType;
})[];

@ApiTags('Mutation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mutation')
export class MutationController {
  constructor(private readonly mutationService: MutationService) {}

  @Get('tree')
  @ApiOperation({ summary: 'Get the mutation tree with researched levels' })
  @ApiResponse({ status: 200, description: 'Mutation tree with player progress' })
  async getTree(
    @Req() req: Request & { user: { userId: string } },
  ): Promise<TreeResponse> {
    return this.mutationService.getTree(req.user.userId);
  }

  @Post('research')
  @ApiOperation({ summary: 'Research the next level of a mutation (instant)' })
  @ApiResponse({ status: 200, description: 'Mutation researched successfully' })
  @ApiResponse({ status: 400, description: 'Invalid type, prerequisites not met, or insufficient DNA Nectar' })
  async research(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: ResearchDto,
  ): Promise<ResearchResponse> {
    return this.mutationService.researchMutation(
      req.user.userId,
      dto.mutationType,
    );
  }
}
