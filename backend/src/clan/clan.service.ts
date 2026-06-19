import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClanRole, DiplomacyStatus } from '@a-raj/shared';
import type { ClanData, ClanMemberData } from '@a-raj/shared';

/**
 * Clan service — manages clan creation, membership, trades, and diplomacy.
 *
 * Rules:
 *  - A user can only be in one clan at a time.
 *  - Clan creator becomes LEADER automatically.
 *  - Only LEADER can promote/demote members.
 *  - Only LEADER and OFFICER can set diplomacy.
 *  - Trades must be between members of the same clan.
 *  - Trades deduct resources from sender's hive and add to receiver's hive.
 */
@Injectable()
export class ClanService {
  private readonly logger = new Logger(ClanService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== CRUD ====================

  /**
   * Create a new clan. The creating user becomes LEADER.
   */
  async createClan(
    userId: string,
    name: string,
    description: string,
    colorHex: string,
  ): Promise<{ clan: ClanData; member: ClanMemberData }> {
    // Validate name
    if (!name || name.trim().length < 2) {
      throw new BadRequestException('Clan name must be at least 2 characters');
    }
    if (name.trim().length > 30) {
      throw new BadRequestException('Clan name must be at most 30 characters');
    }

    // Check if user is already in a clan
    const existingMembership = await this.prisma.clanMember.findUnique({
      where: { userId },
    });
    if (existingMembership) {
      throw new BadRequestException('You are already in a clan. Leave it first.');
    }

    // Check if clan name is taken
    const existingClan = await this.prisma.clan.findUnique({
      where: { name: name.trim() },
    });
    if (existingClan) {
      throw new BadRequestException('Clan name is already taken');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const clan = await tx.clan.create({
        data: {
          name: name.trim(),
          description: description?.trim() ?? '',
          colorHex: colorHex?.trim() ?? '#cc3333',
        },
      });

      const member = await tx.clanMember.create({
        data: {
          clanId: clan.id,
          userId,
          role: ClanRole.LEADER,
        },
        include: { user: { select: { username: true } } },
      });

      return { clan, member };
    });

    this.logger.log(
      `Clan "${result.clan.name}" created by ${result.member.user.username} [${result.clan.id}]`,
    );

    return {
      clan: {
        id: result.clan.id,
        name: result.clan.name,
        colorHex: result.clan.colorHex,
        description: result.clan.description,
        memberCount: 1,
        leaderId: userId,
      },
      member: {
        userId,
        username: result.member.user.username,
        role: ClanRole.LEADER,
        joinedAt: result.member.joinedAt.toISOString(),
      },
    };
  }

  /**
   * Get clan details with members list.
   */
  async getClan(clanId: string): Promise<{ clan: ClanData; members: ClanMemberData[] }> {
    const clan = await this.prisma.clan.findUnique({
      where: { id: clanId },
      include: {
        members: {
          include: { user: { select: { username: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!clan) {
      throw new NotFoundException('Clan not found');
    }

    const leader = clan.members.find((m) => m.role === ClanRole.LEADER);

    return {
      clan: {
        id: clan.id,
        name: clan.name,
        colorHex: clan.colorHex,
        description: clan.description,
        memberCount: clan.members.length,
        leaderId: leader?.userId ?? '',
      },
      members: clan.members.map((m) => ({
        userId: m.userId,
        username: m.user.username,
        role: m.role as ClanRole,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  // ==================== Membership ====================

  /**
   * Join a clan as MEMBER.
   */
  async joinClan(
    userId: string,
    clanId: string,
  ): Promise<ClanMemberData> {
    // Check if user is already in a clan
    const existingMembership = await this.prisma.clanMember.findUnique({
      where: { userId },
    });
    if (existingMembership) {
      throw new BadRequestException('You are already in a clan. Leave it first.');
    }

    // Check clan exists
    const clan = await this.prisma.clan.findUnique({
      where: { id: clanId },
    });
    if (!clan) {
      throw new NotFoundException('Clan not found');
    }

    try {
      const member = await this.prisma.clanMember.create({
        data: { clanId, userId, role: ClanRole.MEMBER },
        include: { user: { select: { username: true } } },
      });

      this.logger.log(
        `${member.user.username} joined clan "${clan.name}"`,
      );

      return {
        userId,
        username: member.user.username,
        role: ClanRole.MEMBER,
        joinedAt: member.joinedAt.toISOString(),
      };
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === 'P2002') {
        throw new BadRequestException('You are already in a clan');
      }
      throw e;
    }
  }

  /**
   * Leave a clan. LEADER cannot leave unless they promote someone else first.
   */
  async leaveClan(userId: string): Promise<void> {
    const membership = await this.prisma.clanMember.findUnique({
      where: { userId },
      include: { clan: { include: { members: true } } },
    });

    if (!membership) {
      throw new BadRequestException('You are not in a clan');
    }

    if (membership.role === ClanRole.LEADER) {
      // Check if there are other members
      const otherMembers = membership.clan.members.filter(
        (m) => m.userId !== userId,
      );
      if (otherMembers.length > 0) {
        throw new BadRequestException(
          'You are the Leader. Promote someone to Leader first, or disband the clan.',
        );
      }
      // Clan has no other members — delete the clan
      await this.prisma.clan.delete({ where: { id: membership.clanId } });
      this.logger.log(
        `Clan "${membership.clan.name}" disbanded (last member left)`,
      );
      return;
    }

    await this.prisma.clanMember.delete({ where: { id: membership.id } });
    this.logger.log(
      `${userId} left clan "${membership.clan.name}"`,
    );
  }

  /**
   * Promote or demote a member. Only LEADER can do this.
   */
  async promoteMember(
    leaderUserId: string,
    targetUserId: string,
    newRole: ClanRole,
  ): Promise<ClanMemberData> {
    // Validate new role
    if (!Object.values(ClanRole).includes(newRole)) {
      throw new BadRequestException(`Invalid role: ${newRole}`);
    }

    // Verify the caller is a LEADER
    const leaderMembership = await this.prisma.clanMember.findUnique({
      where: { userId: leaderUserId },
    });
    if (!leaderMembership || leaderMembership.role !== ClanRole.LEADER) {
      throw new ForbiddenException('Only the Clan Leader can promote members');
    }

    // Find the target member in the same clan
    const targetMembership = await this.prisma.clanMember.findUnique({
      where: { userId: targetUserId },
      include: { user: { select: { username: true } } },
    });

    if (
      !targetMembership ||
      targetMembership.clanId !== leaderMembership.clanId
    ) {
      throw new NotFoundException(
        'Member not found in your clan',
      );
    }    if (
      targetMembership.role === newRole
    ) {
      throw new BadRequestException(
        `Member already has role ${newRole}`,
      );
    }

    // Execute promotion in a transaction (demote leader + promote target)
    const updated = await this.prisma.$transaction(async (tx) => {
      if (newRole === ClanRole.LEADER) {
        await tx.clanMember.update({
          where: { id: leaderMembership.id },
          data: { role: ClanRole.OFFICER },
        });
      }

      return tx.clanMember.update({
        where: { id: targetMembership.id },
        data: { role: newRole },
        include: { user: { select: { username: true } } },
      });
    });

    this.logger.log(
      `${targetMembership.user.username} promoted to ${newRole} by leader`,
    );

    return {
      userId: targetUserId,
      username: updated.user.username,
      role: newRole,
      joinedAt: updated.joinedAt.toISOString(),
    };
  }

  // ==================== Trading (Belső Feromon Piac) ====================

  /**
   * Send resources to another clan member.
   * Deducts from sender's hive, adds to receiver's hive.
   */
  async tradeResources(
    fromUserId: string,
    toUserId: string,
    resourceType: string,
    amount: number,
  ): Promise<{ tradeId: string; fromBalance: number; toBalance: number }> {
    // Validate resource type
    if (!['BIOMASS', 'WATER', 'DNA_NECTAR'].includes(resourceType)) {
      throw new BadRequestException(
        `Invalid resource type: ${resourceType}. Must be BIOMASS, WATER, or DNA_NECTAR.`,
      );
    }

    if (amount <= 0 || !Number.isFinite(amount)) {
      throw new BadRequestException('Amount must be a positive number');
    }

    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot trade with yourself');
    }

    // Verify both users are in the same clan
    const fromMembership = await this.prisma.clanMember.findUnique({
      where: { userId: fromUserId },
      include: { clan: true },
    });

    if (!fromMembership) {
      throw new BadRequestException('You are not in a clan');
    }

    const toMembership = await this.prisma.clanMember.findUnique({
      where: { userId: toUserId },
    });

    if (
      !toMembership ||
      toMembership.clanId !== fromMembership.clanId
    ) {
      throw new BadRequestException(
        'Target user is not in your clan',
      );
    }

    // Get both hives
    const fromHive = await this.prisma.hive.findFirst({
      where: { userId: fromUserId },
    });
    if (!fromHive) {
      throw new NotFoundException('Sender hive not found');
    }

    const toHive = await this.prisma.hive.findFirst({
      where: { userId: toUserId },
    });
    if (!toHive) {
      throw new NotFoundException('Receiver hive not found');
    }

    // Map resource type to Prisma field name
    const prismaFieldMap: Record<string, 'biomass' | 'water' | 'dnaNectar'> = {
      BIOMASS: 'biomass',
      WATER: 'water',
      DNA_NECTAR: 'dnaNectar',
    };
    const prismaField = prismaFieldMap[resourceType];
    if (!prismaField) {
      throw new BadRequestException(`Invalid resource type: ${resourceType}`);
    }

    // Execute trade in transaction — checks balance atomically to prevent TOCTOU
    const result = await this.prisma.$transaction(async (tx) => {
      // Re-fetch sender hive inside transaction for atomic balance check
      const senderHive = await tx.hive.findUnique({
        where: { id: fromHive.id },
      });
      if (!senderHive || senderHive[prismaField] < amount) {
        throw new BadRequestException(
          `Not enough ${resourceType}. Have ${senderHive ? Math.floor(senderHive[prismaField]) : 0}, need ${amount}.`,
        );
      }

      // Deduct from sender
      const updatedFrom = await tx.hive.update({
        where: { id: fromHive.id },
        data: { [prismaField]: { decrement: amount } },
      });

      // Add to receiver
      const updatedTo = await tx.hive.update({
        where: { id: toHive.id },
        data: { [prismaField]: { increment: amount } },
      });

      // Log the trade
      const trade = await tx.clanTrade.create({
        data: {
          clanId: fromMembership.clanId,
          fromUserId,
          toUserId,
          resourceType,
          amount,
        },
      });

      return {
        tradeId: trade.id,
        fromBalance: updatedFrom[prismaField],
        toBalance: updatedTo[prismaField],
      };
    });

    this.logger.log(
      `Trade: ${fromUserId} → ${toUserId} ${amount} ${resourceType} [${result.tradeId}]`,
    );

    return result;
  }

  // ==================== Diplomacy ====================

  /**
   * Set diplomacy status between two clans.
   * Only LEADER or OFFICER can do this.
   */
  async setDiplomacy(
    userId: string,
    targetClanId: string,
    status: DiplomacyStatus,
  ): Promise<{ clanId: string; targetClanId: string; status: DiplomacyStatus }> {
    // Validate status
    if (!Object.values(DiplomacyStatus).includes(status)) {
      throw new BadRequestException(`Invalid diplomacy status: ${status}`);
    }

    // Verify the caller is LEADER or OFFICER
    const membership = await this.prisma.clanMember.findUnique({
      where: { userId },
    });

    if (!membership) {
      throw new BadRequestException('You are not in a clan');
    }

    if (
      membership.role !== ClanRole.LEADER &&
      membership.role !== ClanRole.OFFICER
    ) {
      throw new ForbiddenException(
        'Only Leader or Officer can set diplomacy',
      );
    }

    // Can't set diplomacy with own clan
    if (membership.clanId === targetClanId) {
      throw new BadRequestException('Cannot set diplomacy with your own clan');
    }

    // Verify target clan exists
    const targetClan = await this.prisma.clan.findUnique({
      where: { id: targetClanId },
    });
    if (!targetClan) {
      throw new NotFoundException('Target clan not found');
    }

    const diplomacy = await this.prisma.clanDiplomacy.upsert({
      where: {
        clanId_targetClanId: {
          clanId: membership.clanId,
          targetClanId,
        },
      },
      update: { status },
      create: {
        clanId: membership.clanId,
        targetClanId,
        status,
      },
    });

    this.logger.log(
      `Diplomacy: clan ${membership.clanId} → ${targetClanId} = ${status}`,
    );

    return {
      clanId: diplomacy.clanId,
      targetClanId: diplomacy.targetClanId,
      status: diplomacy.status as DiplomacyStatus,
    };
  }

  /**
   * Get all diplomacy relations for a user's clan.
   */
  async getDiplomaciesForUser(userId: string) {
    const membership = await this.prisma.clanMember.findUnique({
      where: { userId },
    });
    if (!membership) {
      return [];
    }
    return this.getDiplomacies(membership.clanId);
  }

  /**
   * Get all diplomacy relations for a clan.
   */
  async getDiplomacies(clanId: string) {
    const diplomacies = await this.prisma.clanDiplomacy.findMany({
      where: { clanId },
      include: {
        targetClan: {
          select: { id: true, name: true, colorHex: true },
        },
      },
    });

    return diplomacies.map((d) => ({
      clanId: d.clanId,
      targetClanId: d.targetClanId,
      targetClanName: d.targetClan.name,
      targetClanColor: d.targetClan.colorHex,
      status: d.status as DiplomacyStatus,
      setAt: d.setAt.toISOString(),
    }));
  }
}
