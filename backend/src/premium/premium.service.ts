import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PremiumTier,
  CosmeticSkinType,
  TransactionType,
  COSMETIC_COSTS,
  PREMIUM_HATCH_BOOST,
  PREMIUM_MONTHLY_COST,
} from '@a-raj/shared';
import type { TransactionData, HiveCosmeticData } from '@a-raj/shared';

/**
 * Premium Service — manages premium accounts, Zselé purchases,
 * cosmetic skins, and hatch boost calculation.
 *
 * Stripe integration is deferred (PaymentProvider interface placeholder).
 * Currently, premium activation is done via the API directly (testing mode).
 */
@Injectable()
export class PremiumService {
  private readonly logger = new Logger(PremiumService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the user's premium status.
   * Uses currentTier from JWT to avoid unnecessary DB query.
   * TODO: Track Zselé balance on User model when Stripe is integrated.
   */
  async getStatus(
    currentTier: PremiumTier,
  ): Promise<{ tier: PremiumTier; zseleBalance: number }> {
    return {
      tier: currentTier,
      zseleBalance: 0, // TODO: Read from User.zsele when field is added
    };
  }

  /**
   * Activate premium for a user (simulates successful payment).
   * In production, this would be called by the Stripe webhook handler.
   */
  async activatePremium(userId: string): Promise<{
    tier: PremiumTier;
    transaction: TransactionData;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.premiumTier === PremiumTier.PREMIUM) {
      throw new BadRequestException('User is already PREMIUM');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { premiumTier: PremiumTier.PREMIUM },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.PREMIUM_PURCHASE,
          amount: 0, // No real money in testing
          zseleSpent: PREMIUM_MONTHLY_COST,
          description: 'Prémium fiók aktiválása (1 hónap)',
        },
      });

      return { updated, transaction };
    });

    this.logger.log(`User ${userId} upgraded to PREMIUM`);

    return {
      tier: result.updated.premiumTier as PremiumTier,
      transaction: {
        id: result.transaction.id,
        userId: result.transaction.userId,
        type: result.transaction.type as TransactionType,
        amount: result.transaction.amount,
        zseleSpent: result.transaction.zseleSpent,
        description: result.transaction.description,
        createdAt: result.transaction.createdAt.toISOString(),
      },
    };
  }

  /**
   * Check if user is premium and return hatch boost multiplier.
   * Returns 1.0 (no boost) for FREE users, 0.9 (10% faster) for PREMIUM.
   */
  async getHatchBoostFactor(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.premiumTier !== PremiumTier.PREMIUM) {
      return 1.0;
    }

    return PREMIUM_HATCH_BOOST;
  }

  /**
   * Get all cosmetic skins for the user's hives.
   */
  async getCosmetics(userId: string): Promise<HiveCosmeticData[]> {
    const hives = await this.prisma.hive.findMany({
      where: { userId },
      include: { cosmetic: true },
    });

    return hives.map((h) => ({
      hiveId: h.id,
      skinType: (h.cosmetic?.skinType as CosmeticSkinType) ?? CosmeticSkinType.DEFAULT,
    }));
  }

  /**
   * Set a cosmetic skin for a specific hive.
   * Validates that the hive belongs to the user.
   */
  async setCosmetic(
    userId: string,
    hiveId: string,
    skinType: CosmeticSkinType,
  ): Promise<HiveCosmeticData> {
    if (!Object.values(CosmeticSkinType).includes(skinType)) {
      throw new BadRequestException(`Invalid skin type: ${skinType}`);
    }

    // Validate hive ownership
    const hive = await this.prisma.hive.findFirst({
      where: { id: hiveId, userId },
    });

    if (!hive) {
      throw new NotFoundException(
        'Hive not found or does not belong to user',
      );
    }

    const cost = COSMETIC_COSTS[skinType];

    // Upsert the cosmetic record
    await this.prisma.hiveCosmetic.upsert({
      where: { hiveId },
      update: { skinType },
      create: { hiveId, skinType },
    });

    // Record the transaction if it's a paid skin
    if (cost > 0) {
      await this.prisma.transaction.create({
        data: {
          userId,
          type: TransactionType.COSMETIC_PURCHASE,
          amount: 0,
          zseleSpent: cost,
          description: `Skin: ${skinType} hive ${hiveId}`,
        },
      });
    }

    this.logger.log(`User ${userId} set skin ${skinType} on hive ${hiveId}`);

    return { hiveId, skinType };
  }

  /**
   * Get transaction history for a user.
   */
  async getTransactions(userId: string): Promise<TransactionData[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      type: t.type as TransactionType,
      amount: t.amount,
      zseleSpent: t.zseleSpent,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    }));
  }
}
