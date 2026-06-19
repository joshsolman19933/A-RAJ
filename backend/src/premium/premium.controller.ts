import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  type Request,
} from '@nestjs/common';
import { IsString, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PremiumService } from './premium.service.js';
import { CosmeticSkinType, PremiumTier } from '@a-raj/shared';
import type { TransactionData, HiveCosmeticData } from '@a-raj/shared';

class SetCosmeticDto {
  @IsString()
  hiveId!: string;

  @IsIn(Object.values(CosmeticSkinType))
  skinType!: CosmeticSkinType;
}

/**
 * Premium Controller.
 *
 * Endpoints:
 * - GET  /premium/status       – Get premium status + Zselé balance
 * - POST /premium/activate     – Activate premium (simulates payment)
 * - GET  /premium/cosmetics    – Get hive cosmetics
 * - POST /premium/cosmetics    – Set a cosmetic skin for a hive
 * - GET  /premium/transactions – Get transaction history
 */
@Controller('premium')
@UseGuards(JwtAuthGuard)
export class PremiumController {
  constructor(private readonly premiumService: PremiumService) {}

  @Get('status')
  async getStatus(
    @Req() req: Request & { user: { userId: string; premiumTier: PremiumTier } },
  ): Promise<{ tier: PremiumTier; zseleBalance: number }> {
    return this.premiumService.getStatus(req.user.premiumTier);
  }

  @Post('activate')
  async activate(
    @Req() req: Request & { user: { userId: string } },
  ): Promise<{ tier: PremiumTier; transaction: TransactionData }> {
    return this.premiumService.activatePremium(req.user.userId);
  }

  @Get('cosmetics')
  async getCosmetics(
    @Req() req: Request & { user: { userId: string } },
  ): Promise<HiveCosmeticData[]> {
    return this.premiumService.getCosmetics(req.user.userId);
  }

  @Post('cosmetics')
  async setCosmetic(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: SetCosmeticDto,
  ): Promise<HiveCosmeticData> {
    return this.premiumService.setCosmetic(
      req.user.userId,
      dto.hiveId,
      dto.skinType,
    );
  }

  @Get('transactions')
  async getTransactions(
    @Req() req: Request & { user: { userId: string } },
  ): Promise<TransactionData[]> {
    return this.premiumService.getTransactions(req.user.userId);
  }
}
