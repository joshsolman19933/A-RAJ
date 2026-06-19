import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WsGateway } from '../ws/ws.gateway.js';
import { PheromoneType, PHEROMONE_TRAIL_DURATION_HOURS } from '@a-raj/shared';
import { WsEvent } from '@a-raj/shared';
import type { HexCoord, PheromoneTrailData } from '@a-raj/shared';

/**
 * Pheromone service — manages pheromone trail drawing, saving, and broadcasting.
 *
 * Only users with OFFICER or LEADER role in a clan can draw trails.
 * Trails are broadcast in real-time via WebSocket to clan members.
 * Trails expire after PHEROMONE_TRAIL_DURATION_HOURS (8 hours).
 */
@Injectable()
export class PheromoneService {
  private readonly logger = new Logger(PheromoneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wsGateway: WsGateway,
  ) {}

  /**
   * Get active (non-expired) trails for a clan.
   */
  async getActiveTrails(clanId: string): Promise<PheromoneTrailData[]> {
    const now = new Date();
    const trails = await this.prisma.feromonTrail.findMany({
      where: {
        clanId,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    return trails.map((t) => ({
      id: t.id,
      clanId: t.clanId,
      type: t.type as PheromoneType,
      path: t.path as unknown as HexCoord[],
      expiresAt: t.expiresAt.toISOString(),
      createdBy: t.createdBy,
    }));
  }

  /**
   * Save a pheromone trail drawn by a user and broadcast to the clan.
   * Validates that the user is OFFICER or LEADER.
   */
  async drawTrail(
    userId: string,
    path: HexCoord[],
    type: PheromoneType,
  ): Promise<PheromoneTrailData> {
    // Validate type
    if (
      type !== PheromoneType.ATTACK &&
      type !== PheromoneType.DEFEND
    ) {
      throw new Error(`Invalid pheromone type: ${type}`);
    }

    // Validate path
    if (!path.length || path.length < 2) {
      throw new Error('Path must have at least 2 points');
    }

    if (path.length > 50) {
      throw new Error('Path cannot exceed 50 points');
    }

    // Check role: must be OFFICER or LEADER
    const membership = await this.prisma.clanMember.findUnique({
      where: { userId },
    });

    if (!membership) {
      throw new Error('You are not in a clan');
    }

    const role = membership.role;
    if (role !== 'LEADER' && role !== 'OFFICER') {
      throw new Error(
        'Only Leader or Officer can draw pheromone trails',
      );
    }

    // Clean up expired trails for this clan (keep DB tidy)
    const now = new Date();
    await this.prisma.feromonTrail.deleteMany({
      where: {
        clanId: membership.clanId,
        expiresAt: { lt: now },
      },
    });

    // Calculate expiration
    const expiresAt = new Date(
      now.getTime() + PHEROMONE_TRAIL_DURATION_HOURS * 3600 * 1000,
    );

    // Save trail
    const trail = await this.prisma.feromonTrail.create({
      data: {
        clanId: membership.clanId,
        type,
        path: path as unknown as object[],
        expiresAt,
        createdBy: userId,
      },
    });

    const trailData: PheromoneTrailData = {
      id: trail.id,
      clanId: trail.clanId,
      type: trail.type as PheromoneType,
      path: trail.path as unknown as HexCoord[],
      expiresAt: trail.expiresAt.toISOString(),
      createdBy: trail.createdBy,
    };

    // Broadcast to clan room via WebSocket
    this.wsGateway.server
      .to(`clan:${membership.clanId}`)
      .emit(WsEvent.PHEROMONE_DRAW, trailData);

    this.logger.log(
      `Pheromone trail saved: ${type} by ${userId} in clan ${membership.clanId}, ${path.length} points`,
    );

    return trailData;
  }

  /**
   * Handle real-time drawing during mouse drag (broadcast only, no save).
   * Called from WebSocket handler — broadcasts to clan for live preview.
   */
  broadcastDrawing(
    clanId: string,
    userId: string,
    partialPath: HexCoord[],
    type: PheromoneType,
  ): void {
    this.wsGateway.server.to(`clan:${clanId}`).emit(WsEvent.PHEROMONE_VISIBLE, {
      userId,
      partialPath,
      type,
    });
  }
}
